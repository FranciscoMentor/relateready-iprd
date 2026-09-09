// services/extendedReport.js
//
// Lógica compartida para generar el PDF del Informe Extendido y enviar (o
// reenviar) el correo de confirmación con el PDF adjunto. Extraído de
// routes/api.js para que la misma lógica la puedan usar dos lugares sin
// duplicarla:
//   - routes/api.js   → GET /api/report/extended/:id (descarga normal, la
//     primera vez dispara el correo de confirmación).
//   - routes/admin.js → botón "Reenviar correo" del panel, para cuando el
//     primer intento falló (ver extended_email_status/error en la base de
//     datos) y Francisco quiere reintentar sin esperar a que el cliente
//     vuelva a descargar el informe.

const db = require("../db/init");
const { RELATIONSHIP_CONTEXTS } = require("../data/relationshipContexts");
const { getBandContent } = require("../data/reportContent");
const { generateExtendedReportPDF } = require("./pdfGenerator");
const { generateAISections } = require("./aiAnalysis");
const { sendMail } = require("./graphMail");
const { extendedReportEmail } = require("./emailTemplates");

// Nombre de archivo para los PDF descargados/adjuntos: "RelateReady -
// <Nombre> - <Tipo>.pdf" en vez del id/UUID interno. Quita caracteres que no
// son seguros en un nombre de archivo, conservando acentos y espacios.
function pdfFilename(clientName, label) {
  const safeName = String(clientName || "")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return `RelateReady - ${safeName || "Informe"} - ${label}.pdf`;
}

/** Genera el PDF del Informe Extendido para un envío ya cargado (ver loadSubmission en routes/api.js / routes/admin.js). */
async function generatePdfForSubmission(sub) {
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

  return generateExtendedReportPDF({
    participant: { name: sub.name, lang: sub.lang, gender: sub.gender },
    scoreResult: sub.scoreResult,
    referral: { triggered: !!sub.referral_triggered },
    aiSections,
    qualitativeAnswers: sub.qualitativeAnswers,
  });
}

/**
 * Envía (o reenvía) el correo de confirmación con el PDF adjunto, y guarda
 * el resultado REAL en la base de datos (extended_email_status/error) — a
 * diferencia de antes, que era "dispara y olvida" y no dejaba ningún rastro
 * visible si fallaba. sendMail() nunca lanza (ver graphMail.js), así que
 * esto tampoco lanza: siempre resuelve con { status, error }.
 */
async function sendExtendedReportEmail(sub, pdf, baseUrl) {
  const { subject, html } = extendedReportEmail({
    name: sub.name,
    lang: sub.lang === "en" ? "en" : "es",
    resultsUrl: `${baseUrl}/?sid=${sub.id}`,
  });
  const result = await sendMail({
    to: sub.email,
    subject,
    html,
    attachments: [
      {
        filename: pdfFilename(sub.name, sub.lang === "en" ? "Extended Report" : "Informe Extendido"),
        contentBytes: pdf,
        contentType: "application/pdf",
      },
    ],
  });
  const status = result.sent ? "sent" : result.reason === "disabled" ? "disabled" : "failed";
  const errorText = result.sent ? null : result.error || result.reason || "Error desconocido";
  db.prepare("UPDATE submissions SET extended_email_status = ?, extended_email_error = ? WHERE id = ?").run(
    status,
    errorText,
    sub.id
  );
  return { status, error: errorText };
}

module.exports = { generatePdfForSubmission, sendExtendedReportEmail, pdfFilename };
