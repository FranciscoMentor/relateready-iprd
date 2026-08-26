const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const db = require("../db/init");
const { DIMENSIONS } = require("../data/dimensions");
const { VIGNETTES } = require("../data/vignettes");
const { RELATIONSHIP_CONTEXTS } = require("../data/relationshipContexts");
const { buildFlatCoreItems, buildFlatDesirabilityItems, buildFlatQualitativeItems } = require("../data/items");
const { scoreTest, checkReferralProtocol } = require("../services/scoring");
const { getBandContent } = require("../data/reportContent");
const { generatePreviewPDF, generateExtendedReportPDF } = require("../services/pdfGenerator");
const { generateAISections } = require("../services/aiAnalysis");
const { preparePayment, confirmPayment, PAYPHONE_ENABLED } = require("../services/payphone");

const CORE_ITEMS_FLAT = buildFlatCoreItems();
const DESIRABILITY_ITEMS_FLAT = buildFlatDesirabilityItems();
const QUALITATIVE_ITEMS_FLAT = buildFlatQualitativeItems();

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
const FREE_ACCESS_CODES = (process.env.FREE_ACCESS_CODES || "")
  .split(",")
  .map((c) => c.trim().toUpperCase())
  .filter(Boolean);

// GET /api/meta?lang=es — todo lo que el frontend necesita para renderizar el test.
// No se exponen 'keying' ni 'dimension' de los ítems núcleo, para no sesgar
// las respuestas de la persona que hace el test.
router.get("/meta", (req, res) => {
  const lang = req.query.lang === "en" ? "en" : "es";
  res.json({
    lang,
    payphoneEnabled: PAYPHONE_ENABLED,
    extendedPriceCents: EXTENDED_PRICE_CENTS,
    dimensions: DIMENSIONS.map((d) => ({ code: d.code, label: d[lang] })),
    relationshipContexts: RELATIONSHIP_CONTEXTS.map((c) => ({ code: c.code, label: c[lang] })),
    vignettes: VIGNETTES.map((v) => ({
      id: v.id,
      escenario: v.escenario[lang],
      pregunta: v.pregunta[lang],
      opciones: v.opciones.map((o) => ({ key: o.key, text: o[lang] })),
    })),
    coreItems: CORE_ITEMS_FLAT.map((i) => ({ id: i.id, text: i[lang] })),
    desirabilityItems: DESIRABILITY_ITEMS_FLAT.map((i) => ({ id: i.id, text: i[lang] })),
    qualitativeItems: QUALITATIVE_ITEMS_FLAT.map((i) => ({ id: i.id, text: i[lang] })),
  });
});

function mapGender(value) {
  if (value === "M" || value === "F") return value;
  return "N";
}

// POST /api/submit — recibe todas las respuestas, califica, guarda, devuelve resumen.
router.post("/submit", (req, res) => {
  try {
    const {
      name,
      lang,
      gender,
      relationshipContextCode,
      relationshipContextText,
      coreResponses,
      desirabilityResponses,
      vignetteResponses,
      qualitativeAnswers,
    } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "El nombre es obligatorio." });
    }
    if (!relationshipContextCode || !relationshipContextText || !relationshipContextText.trim()) {
      return res.status(400).json({ error: "El contexto relacional actual (selección + texto) es obligatorio." });
    }
    const effLang = lang === "en" ? "en" : "es";
    const effGender = mapGender(gender);

    const scoreResult = scoreTest(coreResponses || {}, desirabilityResponses || {});
    const referral = checkReferralProtocol(scoreResult, relationshipContextText, effLang);

    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO submissions
        (id, created_at, name, lang, gender, relationship_context_code, relationship_context_text,
         core_responses, desirability_responses, vignette_responses, qualitative_answers,
         score_result, referral_triggered, payment_status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'pending')`
    ).run(
      id,
      new Date().toISOString(),
      name.trim(),
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

// GET /api/report/preview/:id — PDF del preview gratuito (siempre disponible).
router.get("/report/preview/:id", async (req, res) => {
  const sub = loadSubmission(req.params.id);
  if (!sub) return res.status(404).send("No encontrado.");
  try {
    const pdf = await generatePreviewPDF({
      participant: { name: sub.name, lang: sub.lang, gender: sub.gender },
      scoreResult: sub.scoreResult,
      referral: { triggered: !!sub.referral_triggered },
    });
    res.set("Content-Type", "application/pdf");
    res.send(pdf);
  } catch (err) {
    console.error("GET /api/report/preview —", err);
    res.status(500).send("No se pudo generar el preview.");
  }
});

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

// POST /api/payment/redeem/:id — código de acceso gratuito (paneles de prueba).
// Ver FREE_ACCESS_CODES arriba.
router.post("/payment/redeem/:id", (req, res) => {
  const sub = loadSubmission(req.params.id);
  if (!sub) return res.status(404).json({ error: "No encontrado." });
  const code = String((req.body || {}).code || "").trim().toUpperCase();
  if (!code || !FREE_ACCESS_CODES.includes(code)) {
    return res.status(400).json({ error: "Código no válido." });
  }
  db.prepare("UPDATE submissions SET payment_status = ?, payment_reference = ? WHERE id = ?").run(
    "free",
    `CODE:${code}`,
    sub.id
  );
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
      reference: "RelateReady - Informe Extendido (IPRD)",
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
  try {
    const bandContentByCode = {};
    for (const code of Object.keys(sub.scoreResult.dimensions)) {
      const band = sub.scoreResult.dimensions[code].band;
      bandContentByCode[code] = getBandContent(code, band, sub.lang, sub.gender);
    }
    const contextLabel =
      (RELATIONSHIP_CONTEXTS.find((c) => c.code === sub.relationship_context_code) || {})[sub.lang] ||
      sub.relationship_context_code;

    const aiSections = await generateAISections({
      name: sub.name,
      lang: sub.lang,
      gender: sub.gender,
      relationshipContextLabel: contextLabel,
      relationshipContextText: sub.relationship_context_text,
      scoreResult: sub.scoreResult,
      bandContentByCode,
      qualitativeAnswers: sub.qualitativeAnswers,
    });

    const pdf = await generateExtendedReportPDF({
      participant: { name: sub.name, lang: sub.lang, gender: sub.gender },
      scoreResult: sub.scoreResult,
      referral: { triggered: !!sub.referral_triggered },
      aiSections,
      qualitativeAnswers: sub.qualitativeAnswers,
    });

    db.prepare("UPDATE submissions SET extended_generated_at = ? WHERE id = ?").run(new Date().toISOString(), sub.id);

    res.set("Content-Type", "application/pdf");
    res.send(pdf);
  } catch (err) {
    console.error("GET /api/report/extended —", err);
    res.status(500).send("No se pudo generar el Informe Extendido.");
  }
});

module.exports = router;
