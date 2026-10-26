// routes/sessionNudge.js
//
// Simulación (solo lectura) del correo de seguimiento de la sesión gratuita,
// protegida con la misma clave x-reminder-key que los demás endpoints internos.
// No envía nada ni escribe en la base. Ver services/sessionNudgeScheduler.js.
const express = require("express");
const crypto = require("crypto");
const { simulate } = require("../services/sessionNudgeScheduler");
const { sendMail, GRAPH_MAIL_ENABLED } = require("../services/graphMail");
const { sessionNudgeEmail } = require("../services/emailTemplates");

const router = express.Router();

function keyMatches(given, expected) {
  const a = crypto.createHash("sha256").update(String(given || "")).digest();
  const b = crypto.createHash("sha256").update(String(expected || "")).digest();
  return crypto.timingSafeEqual(a, b);
}

router.get("/simulate", (req, res) => {
  const expected = process.env.REMINDER_API_KEY;
  if (!expected) return res.status(503).json({ ok: false, error: "REMINDER_API_KEY no configurada" });
  if (!keyMatches(req.get("x-reminder-key"), expected)) return res.status(401).json({ ok: false, error: "clave inválida" });
  res.json({ ok: true, ...simulate() });
});

// Envío de PRUEBA del correo, solo a las dos direcciones propias de Francisco
// (nunca a clientes), con datos de ejemplo y asunto "[PRUEBA]". Sirve para ver
// el correo con logo y colores reales desde el servidor.
const TEST_ALLOWED = ["rmdaylon@gmail.com", "franciscorosero@adamantinehealing.onmicrosoft.com"];
router.post("/test", express.json({ limit: "8kb" }), async (req, res) => {
  const expected = process.env.REMINDER_API_KEY;
  if (!expected) return res.status(503).json({ ok: false, error: "REMINDER_API_KEY no configurada" });
  if (!keyMatches(req.get("x-reminder-key"), expected)) return res.status(401).json({ ok: false, error: "clave inválida" });
  if (!GRAPH_MAIL_ENABLED) return res.status(503).json({ ok: false, error: "correo automático deshabilitado" });
  const to = String((req.body && req.body.to) || "").trim().toLowerCase();
  if (!TEST_ALLOWED.includes(to)) return res.status(400).json({ ok: false, error: "destinatario de prueba no permitido" });
  const lang = req.body.lang === "en" ? "en" : "es";
  const { subject, html } = sessionNudgeEmail({ name: "Francisco Prueba", lang, session: { until: "2026-10-31" }, second: req.body.second === true });
  const result = await sendMail({ to, subject: "[PRUEBA] " + subject, html });
  res.json({ ok: !!result.sent, lang, to, error: result.sent ? null : result.error || result.reason || "error" });
});

module.exports = router;
