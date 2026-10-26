// routes/bookingSync.js
//
// Endpoint interno para que la tarea programada "Recordatorio de sesión 24h"
// avise al panel qué personas reservaron su sesión gratuita en Outlook
// Bookings (así "Sesiones marcadas" de Campañas con código se actualiza solo,
// sin tener que abrir el panel ni conectar el calendario).
//
// Seguridad: igual que /internal/reminder-mail, exige x-reminder-key =
// REMINDER_API_KEY. Solo marca "sesion_agendada" a quien ya hizo el test con
// ese mismo correo, y nunca baja un estado posterior.
const express = require("express");
const crypto = require("crypto");
const { applyBookingEvents } = require("../services/bookingSync");

const router = express.Router();

function keyMatches(given, expected) {
  const a = crypto.createHash("sha256").update(String(given || "")).digest();
  const b = crypto.createHash("sha256").update(String(expected || "")).digest();
  return crypto.timingSafeEqual(a, b);
}

router.post("/", express.json({ limit: "256kb" }), (req, res) => {
  const expected = process.env.REMINDER_API_KEY;
  if (!expected) return res.status(503).json({ ok: false, error: "REMINDER_API_KEY no configurada" });
  if (!keyMatches(req.get("x-reminder-key"), expected)) return res.status(401).json({ ok: false, error: "clave inválida" });
  const events = req.body && req.body.events;
  if (!Array.isArray(events)) return res.status(400).json({ ok: false, error: "falta events" });
  const out = applyBookingEvents(events);
  if (out.matched.length) console.log(`[bookingSync] Sesiones vinculadas: ${out.matched.map((m) => m.email).join(", ")}.`);
  res.json({ ok: true, eventsRead: out.eventsRead, matched: out.matched.map((m) => ({ name: m.name, email: m.email, start: m.start })), alreadyKnown: out.alreadyKnown });
});

module.exports = router;
