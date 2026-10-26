// routes/leadInfo.js
//
// Endpoint interno para la tarea programada de recordatorios: dado el correo
// de quien reservó su sesión gratuita en Bookings, devuelve la ubicación que
// esa persona escribió al hacer el test (ciudad, estado si es de EE. UU., y
// país) y su idioma. Con eso se deduce la zona horaria sin pedirle una
// dirección completa en la página de reservas.
//
// Seguridad: exige x-reminder-key = REMINDER_API_KEY. Usa POST (el correo va
// en el cuerpo, no en la URL) y devuelve solo lo necesario.
const express = require("express");
const crypto = require("crypto");
const db = require("../db/init");

const router = express.Router();
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

function keyMatches(given, expected) {
  const a = crypto.createHash("sha256").update(String(given || "")).digest();
  const b = crypto.createHash("sha256").update(String(expected || "")).digest();
  return crypto.timingSafeEqual(a, b);
}

router.post("/", express.json({ limit: "8kb" }), (req, res) => {
  const expected = process.env.REMINDER_API_KEY;
  if (!expected) return res.status(503).json({ ok: false, error: "REMINDER_API_KEY no configurada" });
  if (!keyMatches(req.get("x-reminder-key"), expected)) return res.status(401).json({ ok: false, error: "clave inválida" });
  const email = String((req.body && req.body.email) || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 200) return res.status(400).json({ ok: false, error: "correo inválido" });
  const row = db
    .prepare("SELECT name, city, state, country, lang FROM submissions WHERE lower(email) = ? ORDER BY created_at DESC LIMIT 1")
    .get(email);
  if (!row) return res.json({ ok: true, found: false });
  const location = [row.city, row.state, row.country].map((x) => String(x || "").trim()).filter(Boolean).join(", ");
  res.json({ ok: true, found: true, name: row.name || "", city: row.city || "", state: row.state || "", country: row.country || "", location, lang: row.lang === "en" ? "en" : "es" });
});

module.exports = router;
