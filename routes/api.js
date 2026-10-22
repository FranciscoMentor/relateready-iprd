const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const db = require("../db/init");
const { DIMENSIONS } = require("../data/dimensions");
const { vignettesForGroup } = require("../data/vignettes");
const { RELATIONSHIP_CONTEXTS, contextGroup } = require("../data/relationshipContexts");
const { buildFlatCoreItems, buildFlatDesirabilityItems, coreItemsForGroup, qualitativeItemsForGroup } = require("../data/items");
const { scoreTest, checkReferralProtocol } = require("../services/scoring");
const { preparePayment, confirmPayment, PAYPHONE_ENABLED } = require("../services/payphone");
const { generatePdfForSubmission, sendExtendedReportEmail, triggerExtendedReportEmailOnce, pdfFilename } = require("../services/extendedReport");

const CORE_ITEMS_FLAT = buildFlatCoreItems();
const DESIRABILITY_ITEMS_FLAT = buildFlatDesirabilityItems();

// Precio del Informe Extendido, en centavos. Por defecto $24.99 (ver
// IPRD_estrategia_mercado_y_precio.docx), pero se puede cambiar en cualquier
// momento sin tocar código: agrega/edita la variable de entorno
// EXTENDED_PRICE_CENTS en Render → Environment (ej. 1999 = $19.99) y el
// servicio se reinicia solo con el nuevo precio.
const EXTENDED_PRICE_CENTS = Number(process.env.EXTENDED_PRICE_CENTS) > 0 ? Number(process.env.EXTENDED_PRICE_CENTS) : 2499;

// Códigos de acceso gratuito (para paneles de prueba). Configúralos en Render
// → Environment, variable FREE_ACCESS_CODES, separados por coma
// (ej. "PANEL2026,BETA-ADAMANTINE"). Cualquier persona que ingrese uno de
// estos códigos en la pantalla de resultados desbloquea el Informe Extendido
// sin pagar. No distingue mayúsculas/minúsculas. Vacío por defecto = nadie
// puede canjear nada.
const { FREE_ACCESS_CODES } = require("../services/accessCodes");
const { PROMO_CODE, PROMO_UNTIL_LABEL, promoActive, makeRateLimiter } = require("../services/promo");

// GET /api/meta?lang=es — todo lo que el frontend necesita para renderizar el test.
// No se exponen 'keying' ni 'dimension' de los ítems núcleo, para no sesgar
// las respuestas de la persona que hace el test.
//
// Parámetro opcional ?context=<código de situación relacional>: tras el paso
// de datos personales el frontend lo vuelve a pedir con el contexto elegido
// y recibe viñetas, ítems y preguntas cualitativas con la redacción adaptada
// a esa situación (en pareja, separado/a, divorciado/a, viudo/a, buscando…).
// Los ids de los ítems no cambian, así que el puntaje se calcula igual.
router.get("/meta", (req, res) => {
  const lang = req.query.lang === "en" ? "en" : "es";
  const group = req.query.context ? contextGroup(String(req.query.context)) : "buscando";
  const coreItems = coreItemsForGroup(CORE_ITEMS_FLAT, group);
  res.json({
    lang,
    payphoneEnabled: PAYPHONE_ENABLED,
    extendedPriceCents: EXTENDED_PRICE_CENTS,
    dimensions: DIMENSIONS.map((d) => ({ code: d.code, label: d[lang] })),
    relationshipContexts: RELATIONSHIP_CONTEXTS.map((c) => ({ code: c.code, label: c[lang] })),
    vignettes: vignettesForGroup(group).map((v) => ({
      id: v.id,
      escenario: v.escenario[lang],
      pregunta: v.pregunta[lang],
      opciones: v.opciones.map((o) => ({ key: o.key, text: o[lang] })),
    })),
    coreItems: coreItems.map((i) => ({ id: i.id, text: i[lang] })),
    desirabilityItems: DESIRABILITY_ITEMS_FLAT.map((i) => ({ id: i.id, text: i[lang] })),
    qualitativeItems: qualitativeItemsForGroup(group).map((i) => ({ id: i.id, text: i[lang] })),
  });
});

function mapGender(value) {
  if (value === "M" || value === "F") return value;
  return "N";
}

// Header Content-Disposition con soporte para nombres con acentos: incluye
// tanto un fallback ASCII (filename=) para lectores antiguos, como la
// versión UTF-8 completa (filename*=) que usan los navegadores modernos.
function contentDispositionHeader(filename) {
  const asciiFallback = filename.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, "_");
  return `inline; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

// POST /api/submit — recibe todas las respuestas, califica, guarda, devuelve resumen.
router.post("/submit", (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      city,
      country,
      lang,
      gender,
      relationshipContextCode,
      relationshipContextText,
      coreResponses,
      desirabilityResponses,
      vignetteResponses,
      qualitativeAnswers,
      attribution,
    } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "El nombre es obligatorio." });
    }
    // email/phone/ciudad/país pasaron de opcionales a obligatorios (2026-09):
    // el correo automático del Informe Extendido (Hueco 1) depende de que
    // todo envío tenga un email real, y el seguimiento comercial del panel
    // necesita también teléfono, ciudad y país.
    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ error: "El correo es obligatorio." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: "El correo no es válido." });
    }
    if (!phone || typeof phone !== "string" || !phone.trim()) {
      return res.status(400).json({ error: "El teléfono es obligatorio." });
    }
    if (!city || typeof city !== "string" || !city.trim()) {
      return res.status(400).json({ error: "La ciudad es obligatoria." });
    }
    if (!country || typeof country !== "string" || !country.trim()) {
      return res.status(400).json({ error: "El país es obligatorio." });
    }
    if (!relationshipContextCode || !relationshipContextText || !relationshipContextText.trim()) {
      return res.status(400).json({ error: "El contexto relacional actual (selección + texto) es obligatorio." });
    }
    const effLang = lang === "en" ? "en" : "es";
    const effGender = mapGender(gender);

    const scoreResult = scoreTest(coreResponses || {}, desirabilityResponses || {});
    const referral = checkReferralProtocol(scoreResult, relationshipContextText, effLang);

    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();
    const cleanCity = city.trim();
    const cleanCountry = country.trim();

    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO submissions
        (id, created_at, name, email, phone, city, country, lang, gender, relationship_context_code, relationship_context_text,
         core_responses, desirability_responses, vignette_responses, qualitative_answers,
         score_result, referral_triggered, payment_status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending')`
    ).run(
      id,
      new Date().toISOString(),
      name.trim(),
      cleanEmail,
      cleanPhone,
      cleanCity,
      cleanCountry,
      effLang,
      effGender,
      relationshipContextCode,
      relationshipContextText.trim(),
      JSON.stringify(coreResponses || {}),
      JSON.stringify(desirabilityResponses || {}),
      JSON.stringify(vignetteResponses || {}),
      JSON.stringify(qualitativeAnswers || []),
      JSON.stringify(scoreResult),
      referral.triggered ? 1 : 0
    );

    // Atribución de campaña (utm_* y clic desde anuncio de Meta). Es opcional
    // y nunca debe impedir guardar el test.
    try {
      const a = attribution && typeof attribution === "object" ? attribution : {};
      const clean = (v) => (typeof v === "string" ? v.trim().slice(0, 120) : "");
      db.prepare(
        "UPDATE submissions SET utm_source=?, utm_medium=?, utm_campaign=?, utm_content=?, utm_term=?, from_meta_ad=? WHERE id=?"
      ).run(clean(a.utm_source), clean(a.utm_medium), clean(a.utm_campaign), clean(a.utm_content), clean(a.utm_term), a.from_meta_ad ? 1 : 0, id);
    } catch (e) {
      console.error("[routes/api] No se pudo guardar la atribución —", e.message);
    }

    res.json({
      id,
      scoreSummary: {
        dimensions: scoreResult.dimensions,
        topStrengths: scoreResult.topStrengths,
        topDevelopmentAreas: scoreResult.topDevelopmentAreas,
        overallAverage: scoreResult.overallAverage,
      },
      referralTriggered: referral.triggered,
    });
  } catch (err) {
    console.error("POST /api/submit —", err.message);
    res.status(400).json({ error: err.message });
  }
});

function loadSubmission(id) {
  const row = db.prepare("SELECT * FROM submissions WHERE id = ?").get(id);
  if (!row) return null;
  return {
    ...row,
    scoreResult: JSON.parse(row.score_result),
    qualitativeAnswers: JSON.parse(row.qualitative_answers || "[]"),
  };
}

// POST /api/payment/simulate/:id — desbloquea el Informe Extendido sin cobrar
// de verdad. Solo funciona mientras Payphone NO esté configurado (ver services/payphone.js).
router.post("/payment/simulate/:id", async (req, res) => {
  if (PAYPHONE_ENABLED) return res.status(400).json({ error: "Payphone ya está activo — usa /api/payment/prepare." });
  const sub = loadSubmission(req.params.id);
  if (!sub) return res.status(404).json({ error: "No encontrado." });
  const result = await confirmPayment({ clientTransactionId: sub.id });
  db.prepare("UPDATE submissions SET payment_status = ?, payment_reference = ? WHERE id = ?").run(
    result.simulated ? "simulated" : "paid",
    result.reference || null,
    sub.id
  );
  // Dispara el PDF + correo de inmediato — no depende de que la persona
  // haga clic en "Descargar" (ver triggerExtendedReportEmailOnce en
  // services/extendedReport.js).
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  triggerExtendedReportEmailOnce(sub.id, baseUrl).catch((err) =>
    console.error("[routes/api] Error generando/enviando el Informe Extendido tras pago simulado —", err.message)
  );
  res.json({ ok: true, simulated: result.simulated, reference: result.reference });
});

// GET /api/submission/:id/status — para reconstruir el estado del frontend
// después de volver de la pestaña de pago de Payphone (recarga la página).
router.get("/submission/:id/status", (req, res) => {
  const sub = loadSubmission(req.params.id);
  if (!sub) return res.status(404).json({ error: "No encontrado." });
  res.json({
    id: sub.id,
    lang: sub.lang,
    scoreSummary: {
      dimensions: sub.scoreResult.dimensions,
      topStrengths: sub.scoreResult.topStrengths,
      topDevelopmentAreas: sub.scoreResult.topDevelopmentAreas,
      overallAverage: sub.scoreResult.overallAverage,
    },
    referralTriggered: !!sub.referral_triggered,
    paymentStatus: sub.payment_status,
  });
});

// Aplica un código de acceso gratuito a un envío: mismo estado de pago, misma
// marca code_redeemed_at y mismo disparo del PDF + correo, sea cual sea el
// camino (código escrito a mano o botón de un clic de la promoción).
function applyAccessCode(sub, code, req) {
  db.prepare("UPDATE submissions SET payment_status = ?, payment_reference = ?, code_redeemed_at = ? WHERE id = ?").run(
    "free",
    `CODE:${code}`,
    new Date().toISOString(),
    sub.id
  );
  // Dispara el PDF + correo de inmediato — no depende de que la persona
  // haga clic en "Descargar" (ver triggerExtendedReportEmailOnce en
  // services/extendedReport.js — antes, si nunca hacía clic, el correo no
  // se enviaba nunca, ni con error visible en el panel).
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  triggerExtendedReportEmailOnce(sub.id, baseUrl).catch((err) =>
    console.error("[routes/api] Error generando/enviando el Informe Extendido tras canjear código —", err.message)
  );
}

// POST /api/payment/redeem/:id — código de acceso gratuito escrito a mano
// (paneles de prueba). Ver FREE_ACCESS_CODES arriba.
router.post("/payment/redeem/:id", (req, res) => {
  const sub = loadSubmission(req.params.id);
  if (!sub) return res.status(404).json({ error: "No encontrado." });
  const code = String((req.body || {}).code || "").trim().toUpperCase();
  if (!code || !FREE_ACCESS_CODES.includes(code)) {
    return res.status(400).json({ error: "Código no válido." });
  }
  applyAccessCode(sub, code, req);
  res.json({ ok: true });
});

// GET /api/promo/status — ¿hay promoción activa y hasta cuándo? NUNCA revela
// el código. El cliente lo usa para decidir si muestra la tarjeta de un clic.
router.get("/promo/status", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ active: promoActive(), until: promoActive() ? PROMO_UNTIL_LABEL : null });
});

// POST /api/funnel/:id — marca (una sola vez por envío) que se mostró el
// resumen con la tarjeta de desbloqueo o que se pulsó el botón de un clic.
// Body: { event: "summary_viewed" | "unlock_clicked" }. Solo alimenta el embudo
// del panel; nunca bloquea nada si falla.
const FUNNEL_FIELDS = { summary_viewed: "summary_viewed_at", unlock_clicked: "unlock_clicked_at" };
const funnelIpLimit = makeRateLimiter(60, 60 * 1000);
router.post("/funnel/:id", (req, res) => {
  const field = FUNNEL_FIELDS[String((req.body || {}).event || "")];
  if (!field) return res.status(400).json({ error: "Evento no válido." });
  if (!funnelIpLimit("ip:" + req.ip)) return res.status(429).json({ error: "Demasiadas peticiones." });
  const r = db.prepare(`UPDATE submissions SET ${field} = ? WHERE id = ? AND ${field} IS NULL`).run(new Date().toISOString(), String(req.params.id));
  res.json({ ok: true, recorded: r.changes > 0 });
});

// POST /api/promo/redeem — canje de un clic con el código promocional vigente.
// Body: { submissionId }. Reutiliza applyAccessCode (misma lógica que el canje
// manual). El código nunca viaja al navegador. Límite: 8 intentos por minuto
// por IP y 4 por minuto por envío.
const promoIpLimit = makeRateLimiter(8, 60 * 1000);
const promoSubLimit = makeRateLimiter(4, 60 * 1000);
router.post("/promo/redeem", (req, res) => {
  const submissionId = String((req.body || {}).submissionId || "");
  if (!promoIpLimit("ip:" + req.ip) || !promoSubLimit("sub:" + submissionId)) {
    return res.status(429).json({ error: "Demasiados intentos. Espera un minuto.", reason: "rate_limited" });
  }
  if (!promoActive()) {
    return res.status(410).json({ error: "La promoción ya no está activa.", reason: "promo_inactive" });
  }
  const sub = submissionId ? loadSubmission(submissionId) : null;
  if (!sub) return res.status(404).json({ error: "No encontrado.", reason: "not_found" });
  if (sub.payment_status && sub.payment_status !== "pending") {
    return res.status(409).json({ error: "Este informe ya está desbloqueado.", reason: "already_unlocked" });
  }
  applyAccessCode(sub, PROMO_CODE, req);
  res.json({ ok: true });
});

// POST /api/payment/prepare/:id — pago real con Payphone: prepara la
// transacción y devuelve la URL a la que abrir una pestaña nueva para pagar.
router.post("/payment/prepare/:id", async (req, res) => {
  if (!PAYPHONE_ENABLED) return res.status(400).json({ error: "Payphone no está configurado todavía." });
  const sub = loadSubmission(req.params.id);
  if (!sub) return res.status(404).json({ error: "No encontrado." });
  try {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const clientTransactionId = `${sub.id}-${Date.now()}`;
    const result = await preparePayment({
      amountCents: EXTENDED_PRICE_CENTS,
      clientTransactionId,
      reference: "RelateReady - Informe Extendido",
      responseUrl: `${baseUrl}/?sid=${sub.id}`,
    });
    db.prepare("UPDATE submissions SET payment_reference = ? WHERE id = ?").run(clientTransactionId, sub.id);
    res.json({ ok: true, payWithCard: result.payWithCard, payWithPayPhone: result.payWithPayPhone });
  } catch (err) {
    console.error("POST /api/payment/prepare —", err.message);
    res.status(500).json({ error: "No se pudo iniciar el pago con Payphone." });
  }
});

// GET /api/payment/confirm/:id — llamado por el frontend al volver de Payphone,
// con los parámetros ?id=...&clientTransactionId=... que Payphone añade a responseUrl.
router.get("/payment/confirm/:id", async (req, res) => {
  if (!PAYPHONE_ENABLED) return res.status(400).json({ error: "Payphone no está configurado todavía." });
  const sub = loadSubmission(req.params.id);
  if (!sub) return res.status(404).json({ error: "No encontrado." });
  const { id: payphoneId, clientTransactionId } = req.query;
  if (!payphoneId || !clientTransactionId) return res.status(400).json({ error: "Faltan parámetros de Payphone." });
  try {
    const result = await confirmPayment({ id: payphoneId, clientTransactionId });
    if (result.approved) {
      db.prepare("UPDATE submissions SET payment_status = ?, payment_reference = ? WHERE id = ?").run(
        "paid",
        result.reference || clientTransactionId,
        sub.id
      );
      // Dispara el PDF + correo de inmediato — no depende de que la persona
      // haga clic en "Descargar" (ver triggerExtendedReportEmailOnce en
      // services/extendedReport.js).
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      triggerExtendedReportEmailOnce(sub.id, baseUrl).catch((err) =>
        console.error("[routes/api] Error generando/enviando el Informe Extendido tras pago con Payphone —", err.message)
      );
    }
    res.json({ ok: true, approved: result.approved });
  } catch (err) {
    console.error("GET /api/payment/confirm —", err.message);
    res.status(500).json({ error: "No se pudo confirmar el pago con Payphone." });
  }
});

// GET /api/report/extended/:id — requiere pago (simulado o real).
router.get("/report/extended/:id", async (req, res) => {
  const sub = loadSubmission(req.params.id);
  if (!sub) return res.status(404).send("No encontrado.");
  if (sub.payment_status === "pending") {
    return res.status(402).send("Pago requerido para el Informe Extendido.");
  }
  // Se captura ANTES de generar/actualizar: si ya tenía fecha, esta no es la
  // primera vez que se genera el PDF (por ejemplo, la persona lo vuelve a
  // descargar después) — el correo de confirmación con el adjunto solo debe
  // salir una vez, la primera.
  const isFirstGeneration = !sub.extended_generated_at;
  try {
    const pdf = await generatePdfForSubmission(sub);

    db.prepare("UPDATE submissions SET extended_generated_at = ? WHERE id = ?").run(new Date().toISOString(), sub.id);

    // Correo con el informe adjunto — solo la primera vez, y solo si la
    // persona dejó su correo. No bloquea la descarga: la respuesta al
    // navegador sale igual aunque Graph tarde o falle; el resultado real
    // (enviado/error/deshabilitado) queda guardado en
    // extended_email_status/extended_email_error — ver
    // services/extendedReport.js — para que el panel lo pueda mostrar y,
    // si falló, reintentar con un clic.
    if (isFirstGeneration && sub.email) {
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      sendExtendedReportEmail(sub, pdf, baseUrl).catch((err) =>
        console.error("[routes/api] Error inesperado enviando correo de confirmación —", err.message)
      );
    }

    const filename = pdfFilename(sub.name, sub.lang === "en" ? "Extended Report" : "Informe Extendido");
    res.set("Content-Type", "application/pdf");
    res.set("Content-Disposition", contentDispositionHeader(filename));
    res.send(pdf);
  } catch (err) {
    console.error("GET /api/report/extended —", err);
    res.status(500).send("No se pudo generar el Informe Extendido.");
  }
});

module.exports = router;
