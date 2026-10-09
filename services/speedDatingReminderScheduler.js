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
// mundo. IMPORTANTE (bug corregido 2026-09-30): "hoy" para calcular
// "faltan 3/1 días" se calcula en hora de Ecuador, NO en UTC del
// servidor. Render corre en UTC, que va 5 horas adelante de Ecuador —
// si se usara la fecha UTC tal cual, desde las 7pm hora de Ecuador en
// adelante el calendario UTC ya marca el día siguiente, y el evento se
// ve "un día más cerca" de lo que realmente es en Ecuador. Esto causó
// que el recordatorio de 1 día antes (que ya no depende de una hora
// mínima salvo por REMINDER_1D_MIN_LOCAL_HOUR) se disparara la noche
// anterior en vez de la mañana del día correcto, porque para esa hora
// de la noche ya "cumplía" tanto el día (por el desfase UTC) como la
// hora mínima (7pm ya es >= 10am). Por eso "hoy" ahora se calcula
// restando el offset de Ecuador antes de leer la fecha calendario.

const db = require("../db/init");
const { sendMail, GRAPH_MAIL_ENABLED } = require("./graphMail");
const { speedDatingReminder3dEmail, speedDatingReminder1dEmail, speedDatingSameDayReminderEmail } = require("./emailTemplates");

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // cada hora
const FIRST_CHECK_DELAY_MS = 4 * 60 * 1000; // 4 min después de arrancar (reminderScheduler usa 2, speedDatingScheduler usa 3)

// El recordatorio de 1 día antes no debe salir a cualquier hora random según
// cuándo arrancó el servidor — se fija para que nunca salga antes de las
// 10:00 a.m. hora de Ecuador (America/Guayaquil, UTC-5 todo el año, sin
// horario de verano). Como este proceso revisa cada hora, en la práctica
// sale dentro de la primera revisión desde las 10 a.m. en adelante ese día.
// El de 3 días antes no tiene esta restricción (no se pidió).
const REMINDER_1D_MIN_LOCAL_HOUR = 10;
const ECUADOR_UTC_OFFSET_HOURS = -5;

function ecuadorLocalHour() {
  const utcHour = new Date().getUTCHours();
  return (utcHour + ECUADOR_UTC_OFFSET_HOURS + 24) % 24;
}

// Fecha calendario ("YYYY-MM-DD") de "hoy" en hora de Ecuador, no en UTC
// del servidor — ver nota arriba. Se logra desplazando el instante actual
// por el offset de Ecuador antes de leer su fecha en UTC.
function ecuadorTodayStr() {
  const shifted = new Date(Date.now() + ECUADOR_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

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
  const todayStr = ecuadorTodayStr();
  const diffMs = new Date(`${eventDate}T00:00:00Z`) - new Date(`${todayStr}T00:00:00Z`);
  return Math.round(diffMs / 86400000);
}

async function sendReminderToEvent(event, { column, buildEmail, extraEmailOptions = {} }) {
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
    const asistenteUrl = `${baseUrl()}/encuentro/asistente.html?token=${attendee.vote_token}`;
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
      ...extraEmailOptions,
    });

    const result = await sendMail({ to: attendee.email, subject, html });
    if (result.sent) {
      db.prepare(`UPDATE sd_attendees SET ${column} = ? WHERE id = ?`).run(new Date().toISOString(), attendee.id);
      console.log(`[speedDatingReminderScheduler] ${column} enviado a ${attendee.email} (evento ${event.name}).`);
    }
  }
}

// ── Reenvío manual corregido del recordatorio de 1 día antes ────────────
// Botón de emergencia (panel de admin) para cuando el automático salió a
// la hora/día equivocado — ver bug corregido arriba (2026-09-30). Resetea
// la marca de "ya enviado" de TODOS los asistentes activos del evento y
// vuelve a enviar de inmediato, con una nota de disculpa + confirmación de
// la fecha real del evento (correctionNote), en vez de esperar a la
// próxima revisión horaria automática.
async function resendReminder1dCorrected(eventId) {
  const event = db.prepare("SELECT * FROM sd_events WHERE id = ?").get(eventId);
  if (!event) return { ok: false, reason: "event_not_found" };

  db.prepare("UPDATE sd_attendees SET reminder_1d_sent_at = NULL WHERE event_id = ? AND cancelled_at IS NULL").run(eventId);

  await sendReminderToEvent(event, {
    column: "reminder_1d_sent_at",
    buildEmail: speedDatingReminder1dEmail,
    extraEmailOptions: { correctionNote: true },
  });

  return { ok: true };
}

// ── Recordatorio manual del mismo día ────────────────────────────────────
// Botón de emergencia/último momento (panel de admin) para avisar unas
// horas antes del evento — no es automático (no depende de daysUntil ni
// del chequeo cada hora) porque Francisco lo dispara a mano cuando quiere,
// típicamente la misma tarde del evento. Usa reminder_sameday_sent_at para
// no reenviar dos veces a quien ya lo recibió si se hace doble clic, pero
// a diferencia de resendReminder1dCorrected NO resetea nada — siempre
// manda solo a quien todavía no lo tenga marcado.
async function sendSameDayReminder(eventId) {
  const event = db.prepare("SELECT * FROM sd_events WHERE id = ?").get(eventId);
  if (!event) return { ok: false, reason: "event_not_found" };

  await sendReminderToEvent(event, {
    column: "reminder_sameday_sent_at",
    buildEmail: speedDatingSameDayReminderEmail,
  });

  return { ok: true };
}

async function runOnce() {
  const events = db
    .prepare(`SELECT * FROM sd_events WHERE status = 'registro' AND event_date IS NOT NULL`)
    .all();

  for (const event of events) {
    const days = daysUntil(event.event_date);
    if (days === 3) {
      await sendReminderToEvent(event, { column: "reminder_3d_sent_at", buildEmail: speedDatingReminder3dEmail });
    } else if (days === 1 && ecuadorLocalHour() >= REMINDER_1D_MIN_LOCAL_HOUR) {
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

module.exports = { start, runOnce, resendReminder1dCorrected, sendSameDayReminder };
