// services/speedDatingReminderScheduler.js
//
// Recordatorios automáticos de 3 días y 1 día antes de cada evento de speed
// dating — mismo patrón de temporizador simple (setInterval, revisa una vez
// por hora) que services/reminderScheduler.js y services/
// speedDatingScheduler.js, clonado a propósito para no introducir una
// dependencia nueva (ej. un paquete de cron) solo para esto.
//
// Un evento solo recibe estos recordatorios mientras sigue con registro
// abierto (status = 'registro') y tiene fecha configurada. Cada asistente
// activo (no cancelado, con correo) recibe cada recordatorio una sola vez
// — se guarda en sd_attendees.reminder_3d_sent_at / reminder_1d_sent_at
// (ver migración en db/init.js) apenas se confirma el envío, así que
// aunque este proceso revise varias veces el mismo día nunca se duplica.
//
// sd_events solo guarda la fecha (event_date), no la hora exacta del
// mundo — para no depender del huso horario del servidor (Render corre en
// UTC) al calcular "faltan 3 días", se compara la fecha del evento contra
// la fecha de hoy en UTC, ambas como fechas puras (sin hora). Con una
// revisión cada hora esto es más que suficiente para no perderse el día.

const db = require("../db/init");
const { sendMail, GRAPH_MAIL_ENABLED } = require("./graphMail");
const { speedDatingReminder3dEmail, speedDatingReminder1dEmail } = require("./emailTemplates");

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // cada hora
const FIRST_CHECK_DELAY_MS = 4 * 60 * 1000; // 4 min después de arrancar (reminderScheduler usa 2, speedDatingScheduler usa 3)

function baseUrl() {
  // Render inyecta RENDER_EXTERNAL_URL automáticamente en todo servicio web
  // — no requiere configurar nada a mano. PUBLIC_BASE_URL queda como
  // respaldo manual si hiciera falta (ej. para probar en otro entorno).
  return (process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
}

// Días de diferencia entre la fecha del evento (sd_events.event_date,
// "YYYY-MM-DD") y hoy, contando ambas como fechas puras en UTC — evita
// arrastrar horas/minutos que compliquen la resta.
function daysUntil(eventDate) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const diffMs = new Date(`${eventDate}T00:00:00Z`) - new Date(`${todayStr}T00:00:00Z`);
  return Math.round(diffMs / 86400000);
}

async function sendReminderToEvent(event, { column, buildEmail }) {
  const attendees = db
    .prepare(
      `SELECT * FROM sd_attendees
       WHERE event_id = ?
         AND cancelled_at IS NULL
         AND email IS NOT NULL AND TRIM(email) <> ''
         AND ${column} IS NULL`
    )
    .all(event.id);

  if (!attendees.length) return;

  const testUrl = `${baseUrl()}/`;

  for (const attendee of attendees) {
    const asistenteUrl = `${baseUrl()}/speed-dating/asistente.html?token=${attendee.vote_token}`;
    const { subject, html } = buildEmail({
      name: attendee.name,
      eventName: event.name,
      eventDate: event.event_date,
      eventTime: event.event_time,
      venueName: event.venue_name,
      venueAddress: event.venue_address,
      tableNumber: attendee.gender === "F" ? attendee.table_number : null,
      asistenteUrl,
      testUrl,
    });

    const result = await sendMail({ to: attendee.email, subject, html });
    if (result.sent) {
      db.prepare(`UPDATE sd_attendees SET ${column} = ? WHERE id = ?`).run(new Date().toISOString(), attendee.id);
      console.log(`[speedDatingReminderScheduler] ${column} enviado a ${attendee.email} (evento ${event.name}).`);
    }
  }
}

async function runOnce() {
  const events = db
    .prepare(`SELECT * FROM sd_events WHERE status = 'registro' AND event_date IS NOT NULL`)
    .all();

  for (const event of events) {
    const days = daysUntil(event.event_date);
    if (days === 3) {
      await sendReminderToEvent(event, { column: "reminder_3d_sent_at", buildEmail: speedDatingReminder3dEmail });
    } else if (days === 1) {
      await sendReminderToEvent(event, { column: "reminder_1d_sent_at", buildEmail: speedDatingReminder1dEmail });
    }
  }
}

function start() {
  if (!GRAPH_MAIL_ENABLED) {
    console.log("[speedDatingReminderScheduler] Correo automático deshabilitado — los recordatorios de 3 y 1 día no se activan.");
    return;
  }
  setTimeout(() => runOnce().catch((err) => console.error("[speedDatingReminderScheduler]", err.message)), FIRST_CHECK_DELAY_MS);
  setInterval(() => runOnce().catch((err) => console.error("[speedDatingReminderScheduler]", err.message)), CHECK_INTERVAL_MS);
  console.log("[speedDatingReminderScheduler] Activo — revisa cada hora si hay eventos a 3 o 1 día de distancia.");
}

module.exports = { start, runOnce };
