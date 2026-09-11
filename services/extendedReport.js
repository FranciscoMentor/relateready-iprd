// services/extendedReport.js
//
// Lógica compartida para generar el PDF del Informe Extendido y enviar (o
// reenviar) el correo de confirmación con el PDF adjunto. Extraído de
// routes/api.js para que la misma lógica la puedan usar varios lugares sin
// duplicarla:
//   - routes/api.js   → los 4 puntos donde payment_status deja de ser
//     'pending' (redeem de código, pago simulado, confirmación real de
//     Payphone) llaman a triggerExtendedReportEmailOnce() de inmediato, y
//     GET /api/report/extended/:id (descarga manual) sigue generando el PDF
//     bajo demanda para servirlo al navegador.
//   - routes/admin.js → "marcar como pagado" manual llama también a
//     triggerExtendedReportEmailOnce(), y el botón "Reenviar correo" llama a
//     generatePdfForSubmission()/sendExtendedReportEmail() directamente
//     (sin pasar por el chequeo de "primera vez", porque ahí la intención es
//     forzar un reintento aunque ya se haya intentado antes).
//
// Antes (hasta 2026-09-10) el correo SOLO se disparaba cuando la persona
// hacía clic en "Descargar mi Informe Extendido (PDF)" en la pantalla de
// resultados — si pagaba (o canjeaba un código) y nunca llegaba a hacer ese
// clic, el correo no se enviaba nunca, sin dejar ni siquiera un error
// visible en el panel (caso real: Inés Rivera, código de cortesía,
// 2026-09-10). triggerExtendedReportEmailOnce() existe para que el envío no
// dependa de esa acción del cliente.

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

/**
 * Genera el PDF y envía el correo de confirmación la PRIMERA vez que un
 * envío queda pagado (o recibe un código de cortesía) — sin esperar a que
 * la persona haga clic en "Descargar". Idempotente: si extended_generated_at
 * ya tiene valor (ya se generó antes, desde aquí o desde la descarga
 * manual), no hace nada y devuelve null. Si el envío no dejó correo,
 * tampoco hace nada (no hay a quién enviarle).
 *
 * Nunca lanza — cualquier error (generando el PDF o enviando el correo)
 * queda guardado en extended_email_status/extended_email_error, igual que
 * sendExtendedReportEmail(), para que el panel lo muestre y se pueda
 * reintentar con el botón "Reenviar correo".
 */
async function triggerExtendedReportEmailOnce(subId, baseUrl) {
  const row = db.prepare("SELECT * FROM submissions WHERE id = ?").get(subId);
  if (!row || row.extended_generated_at || !row.email) return null;

  const sub = {
    ...row,
    scoreResult: JSON.parse(row.score_result),
    qualitativeAnswers: JSON.parse(row.qualitative_answers || "[]"),
  };

  try {
    const pdf = await generatePdfForSubmission(sub);
    db.prepare("UPDATE submissions SET extended_generated_at = ? WHERE id = ?").run(new Date().toISOString(), sub.id);
    return await sendExtendedReportEmail(sub, pdf, baseUrl);
  } catch (err) {
    console.error(`[extendedReport] Error generando/enviando el Informe Extendido al confirmar pago (${subId}) —`, err.message);
    db.prepare("UPDATE submissions SET extended_email_status = ?, extended_email_error = ? WHERE id = ?").run(
      "failed",
      "No se pudo generar el PDF: " + err.message,
      subId
    );
    return { status: "failed", error: "No se pudo generar el PDF: " + err.message };
  }
}

module.exports = { generatePdfForSubmission, sendExtendedReportEmail, triggerExtendedReportEmailOnce, pdfFilename };
