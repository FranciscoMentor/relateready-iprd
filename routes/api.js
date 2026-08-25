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
const { confirmPayment } = require("../services/payphone");

const CORE_ITEMS_FLAT = buildFlatCoreItems();
const DESIRABILITY_ITEMS_FLAT = buildFlatDesirabilityItems();
const QUALITATIVE_ITEMS_FLAT = buildFlatQualitativeItems();

// GET /api/meta?lang=es — todo lo que el frontend necesita para renderizar el test.
// No se exponen 'keying' ni 'dimension' de los ítems núcleo, para no sesgar
// las respuestas de la persona que hace el test.
router.get("/meta", (req, res) => {
  const lang = req.query.lang === "en" ? "en" : "es";
  res.json({
    lang,
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
// de verdad. Ver services/payphone.js para activar el pago real.
router.post("/payment/simulate/:id", async (req, res) => {
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
