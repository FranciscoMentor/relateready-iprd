// services/speedDatingScheduler.js
//
// Correo automático de resultados 48h después de finalizar un evento de
// speed dating — mismo patrón de temporizador simple (setInterval, revisa
// una vez por hora) que services/reminderScheduler.js, clonado a propósito
// para no introducir una dependencia nueva (ej. un paquete de cron) solo
// para esto.
//
// Un evento se marca "finalizado" (sd_events.status/finalized_at) desde el
// panel del organizador cuando termina la última ronda — ver
// routes/speedDating.js, POST /admin/speed-dating/:eventId/finalizar, que
// además calcula los matches mutuos (sd_matches) en ese momento. Este
// scheduler solo se encarga de, 48h después, enviarle a cada asistente su
// correo de resultados — una sola vez (match_email_status).

const db = require("../db/init");
const { sendMail, GRAPH_MAIL_ENABLED } = require("./graphMail");
const { speedDatingMatchEmail } = require("./emailTemplates");

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // cada hora
const FIRST_CHECK_DELAY_MS = 3 * 60 * 1000; // 3 min después de arrancar

async function runOnce() {
  const pendingEvents = db
    .prepare(
      `SELECT id, name FROM sd_events
       WHERE status = 'finalizado'
         AND finalized_at IS NOT NULL
         AND datetime(finalized_at) <= datetime('now', '-48 hours')`
    )
    .all();

  if (!pendingEvents.length) return;

  for (const event of pendingEvents) {
    const attendees = db
      .prepare(
        `SELECT * FROM sd_attendees
         WHERE event_id = ?
           AND email IS NOT NULL AND TRIM(email) <> ''
           AND match_email_status IS NULL`
      )
      .all(event.id);

    for (const attendee of attendees) {
      const isWoman = attendee.gender === "F";
      const matchRows = db
        .prepare(
          `SELECT * FROM sd_matches WHERE event_id = ? AND ${isWoman ? "woman_id" : "man_id"} = ?`
        )
        .all(event.id, attendee.id);

      const matches = matchRows.map((m) => {
        const partnerId = isWoman ? m.man_id : m.woman_id;
        const partner = db.prepare("SELECT name, phone, share_phone_consent FROM sd_attendees WHERE id = ?").get(partnerId);
        return {
          partnerName: partner ? partner.name : "—",
          partnerPhone: partner && partner.share_phone_consent ? partner.phone : null,
        };
      });

      const { subject, html } = speedDatingMatchEmail({
        name: attendee.name,
        lang: "es",
        eventName: event.name,
        matches,
      });

      const result = await sendMail({ to: attendee.email, subject, html });
      const now = new Date().toISOString();
      if (result.sent) {
        db.prepare(
          "UPDATE sd_attendees SET match_email_status = 'sent', match_email_error = NULL, match_email_sent_at = ? WHERE id = ?"
        ).run(now, attendee.id);
        console.log(`[speedDatingScheduler] Correo de resultados enviado a ${attendee.email} (evento ${event.name}).`);
      } else {
        db.prepare(
          "UPDATE sd_attendees SET match_email_status = 'failed', match_email_error = ? WHERE id = ?"
        ).run(result.reason === "error" ? result.error : result.reason || "desconocido", attendee.id);
      }
    }
  }
}

function start() {
  if (!GRAPH_MAIL_ENABLED) {
    console.log("[speedDatingScheduler] Correo automático deshabilitado — el correo de resultados de 48h no se activa.");
    return;
  }
  setTimeout(() => runOnce().catch((err) => console.error("[speedDatingScheduler]", err.message)), FIRST_CHECK_DELAY_MS);
  setInterval(() => runOnce().catch((err) => console.error("[speedDatingScheduler]", err.message)), CHECK_INTERVAL_MS);
  console.log("[speedDatingScheduler] Activo — revisa cada hora si hay correos de resultados pendientes de 48h.");
}

module.exports = { start, runOnce };
