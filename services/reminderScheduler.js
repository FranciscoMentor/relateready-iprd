// services/reminderScheduler.js
//
// Recordatorio automático (24 horas a 7 días después) para quien completó
// el test, dejó su correo, pero todavía no compró el Informe Extendido —
// "quick win" #1 de las recomendaciones de conversión. No agrega ninguna
// dependencia nueva: usa un temporizador simple (setInterval) que revisa la
// base de datos una vez por hora, más que suficiente para una ventana de
// 24-48h. Se activa llamando a start() desde server.js; si el correo
// automático no está configurado (ver graphMail.js), no hace nada.

const db = require("../db/init");
const { sendMail, GRAPH_MAIL_ENABLED } = require("./graphMail");
const { pendingReportReminderEmail } = require("./emailTemplates");

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // cada hora
const FIRST_CHECK_DELAY_MS = 2 * 60 * 1000; // 2 min después de arrancar, no de inmediato

function baseUrl() {
  // Render inyecta RENDER_EXTERNAL_URL automáticamente en todo servicio web
  // (ej. "https://relateready-iprd.onrender.com") — no requiere configurar
  // nada a mano. PUBLIC_BASE_URL queda como respaldo manual si hiciera falta.
  return (process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
}

async function runOnce() {
  const eligible = db
    .prepare(
      `SELECT id, name, email, lang FROM submissions
       WHERE email IS NOT NULL AND TRIM(email) <> ''
         AND payment_status = 'pending'
         AND reminder_sent_at IS NULL
         AND datetime(created_at) <= datetime('now', '-24 hours')
         AND datetime(created_at) >= datetime('now', '-7 days')`
    )
    .all();

  if (!eligible.length) return;

  for (const sub of eligible) {
    const { subject, html } = pendingReportReminderEmail({
      name: sub.name,
      lang: sub.lang === "en" ? "en" : "es",
      resultsUrl: `${baseUrl()}/?sid=${sub.id}`,
    });
    const result = await sendMail({ to: sub.email, subject, html });
    if (result.sent) {
      db.prepare("UPDATE submissions SET reminder_sent_at = ? WHERE id = ?").run(new Date().toISOString(), sub.id);
      console.log(`[reminderScheduler] Recordatorio enviado a ${sub.email} (submission ${sub.id}).`);
    }
  }
}

function start() {
  if (!GRAPH_MAIL_ENABLED) {
    console.log("[reminderScheduler] Correo automático deshabilitado — el recordatorio de 24-48h no se activa.");
    return;
  }
  setTimeout(() => runOnce().catch((err) => console.error("[reminderScheduler]", err.message)), FIRST_CHECK_DELAY_MS);
  setInterval(() => runOnce().catch((err) => console.error("[reminderScheduler]", err.message)), CHECK_INTERVAL_MS);
  console.log("[reminderScheduler] Activo — revisa cada hora si hay recordatorios pendientes de más de 24h.");
}

module.exports = { start };
