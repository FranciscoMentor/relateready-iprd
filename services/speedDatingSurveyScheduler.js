// services/speedDatingSurveyScheduler.js
//
// Encuesta corta de satisfacción enviada la mañana siguiente al evento,
// antes del mediodía (hora de Ecuador) — mismo patrón de temporizador
// simple (setInterval, revisa cada hora) que services/speedDatingScheduler
// .js (correo de resultados de 48h) y services/speedDatingReminderScheduler
// .js, clonado a propósito para no introducir una dependencia nueva.
//
// Diferencia clave con el correo de resultados: este NO espera 48 horas —
// se dispara en cuanto, en hora de Ecuador, ya es un día calendario
// distinto al de la finalización del evento (sd_events.finalized_at). Como
// los eventos terminan de noche, en la práctica esto cae temprano en la
// mañana siguiente, bien antes del mediodía. Si por algún motivo el
// servidor estuvo caído esa mañana y la primera revisión ocurre ya pasado
// el mediodía, el correo se envía de todas formas en cuanto se detecta —
// se prefiere un envío tardío a no enviarlo nunca (igual criterio que el
// resto de correos automáticos de este archivo).
//
// No pregunta nada sobre matches/resultados: esos se calculan y se envían
// 48h después (services/speedDatingScheduler.js) — a esta hora de la
// mañana siguiente todavía no existen.

const db = require("../db/init");
const { sendMail, GRAPH_MAIL_ENABLED } = require("./graphMail");
const { speedDatingSurveyEmail } = require("./emailTemplates");

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // cada hora
const FIRST_CHECK_DELAY_MS = 5 * 60 * 1000; // 5 min después de arrancar (3 min usa speedDatingScheduler, 4 min speedDatingReminderScheduler)

// Mismo criterio de zona horaria que services/speedDatingReminderScheduler.js
// (ver nota ahí sobre el bug de UTC vs Ecuador corregido 2026-09-30):
// Render corre en UTC, 5 horas adelante de Ecuador todo el año (sin horario
// de verano), así que "qué día es hoy" y "qué día fue finalized_at" se
// calculan restando ese offset antes de leer la fecha calendario.
const ECUADOR_UTC_OFFSET_HOURS = -5;

function ecuadorDateStrOf(isoInstant) {
  const shifted = new Date(new Date(isoInstant).getTime() + ECUADOR_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

function ecuadorTodayStr() {
  return ecuadorDateStrOf(new Date().toISOString());
}

function baseUrl() {
  return (process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
}

async function runOnce() {
  const finalizedEvents = db
    .prepare(`SELECT id, name, venue_name, finalized_at FROM sd_events WHERE status = 'finalizado' AND finalized_at IS NOT NULL`)
    .all();

  if (!finalizedEvents.length) return;

  const todayStr = ecuadorTodayStr();

  for (const event of finalizedEvents) {
    // Elegible solo si, en hora de Ecuador, ya es un día calendario
    // distinto al de la finalización (ver nota arriba) — no antes.
    if (ecuadorDateStrOf(event.finalized_at) >= todayStr) continue;

    const attendees = db
      .prepare(
        `SELECT * FROM sd_attendees
         WHERE event_id = ?
           AND cancelled_at IS NULL
           AND email IS NOT NULL AND TRIM(email) <> ''
           AND survey_email_status IS NULL`
      )
      .all(event.id);

    for (const attendee of attendees) {
      const surveyUrl = `${baseUrl()}/speed-dating/encuesta.html?token=${attendee.vote_token}`;
      const { subject, html } = speedDatingSurveyEmail({
        name: attendee.name,
        eventName: event.name,
        venueName: event.venue_name,
        surveyUrl,
      });

      const result = await sendMail({ to: attendee.email, subject, html });
      const now = new Date().toISOString();
      if (result.sent) {
        db.prepare(
          "UPDATE sd_attendees SET survey_email_status = 'sent', survey_email_error = NULL, survey_email_sent_at = ? WHERE id = ?"
        ).run(now, attendee.id);
        console.log(`[speedDatingSurveyScheduler] Encuesta enviada a ${attendee.email} (evento ${event.name}).`);
      } else {
        db.prepare(
          "UPDATE sd_attendees SET survey_email_status = 'failed', survey_email_error = ? WHERE id = ?"
        ).run(result.reason === "error" ? result.error : result.reason || "desconocido", attendee.id);
      }
    }
  }
}

function start() {
  if (!GRAPH_MAIL_ENABLED) {
    console.log("[speedDatingSurveyScheduler] Correo automático deshabilitado — la encuesta de satisfacción no se activa.");
    return;
  }
  setTimeout(() => runOnce().catch((err) => console.error("[speedDatingSurveyScheduler]", err.message)), FIRST_CHECK_DELAY_MS);
  setInterval(() => runOnce().catch((err) => console.error("[speedDatingSurveyScheduler]", err.message)), CHECK_INTERVAL_MS);
  console.log("[speedDatingSurveyScheduler] Activo — revisa cada hora si hay encuestas de satisfacción pendientes del día siguiente.");
}

module.exports = { start, runOnce };
