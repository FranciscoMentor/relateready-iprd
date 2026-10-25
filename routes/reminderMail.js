// routes/reminderMail.js
//
// Endpoint interno para que la tarea programada "Recordatorio de sesión 24h"
// (Adamantine Mentoring) envíe sus recordatorios con el diseño de marca de
// RelateReady (logo, colores, botón) usando el mismo correo de Microsoft
// Graph que el resto de la app. El conector de Outlook de esa tarea no
// admite estilos ni imágenes; este endpoint sí.
//
// Seguridad: exige el encabezado x-reminder-key igual a REMINDER_API_KEY
// (variable de entorno en Render). No acepta HTML: recibe solo campos de
// texto ya resueltos y los pasa por la plantilla fija sessionReminderEmail
// (que escapa todo). Si REMINDER_API_KEY no está configurada, el endpoint
// responde 503 y la tarea usa su correo sencillo de respaldo.
const express = require("express");
const crypto = require("crypto");
const { sendMail, GRAPH_MAIL_ENABLED } = require("../services/graphMail");
const { sessionReminderEmail } = require("../services/emailTemplates");

const router = express.Router();
const COPY_TO = "FRANCISCOROSERO@ADAMANTINEHEALING.onmicrosoft.com";
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

function keyMatches(given, expected) {
  const a = crypto.createHash("sha256").update(String(given || "")).digest();
  const b = crypto.createHash("sha256").update(String(expected || "")).digest();
  return crypto.timingSafeEqual(a, b);
}

router.post("/", express.json({ limit: "64kb" }), async (req, res) => {
  const expected = process.env.REMINDER_API_KEY;
  if (!expected) return res.status(503).json({ ok: false, error: "REMINDER_API_KEY no configurada" });
  if (!keyMatches(req.get("x-reminder-key"), expected)) return res.status(401).json({ ok: false, error: "clave inválida" });
  if (!GRAPH_MAIL_ENABLED) return res.status(503).json({ ok: false, error: "correo automático deshabilitado" });

  const { to, parts } = req.body || {};
  if (typeof to !== "string" || !EMAIL_RE.test(to.trim())) return res.status(400).json({ ok: false, error: "destinatario inválido" });
  if (!parts || typeof parts !== "object" || !parts.subject || !parts.dayTxt || !parts.timeTxt || !parts.zoneLabel) {
    return res.status(400).json({ ok: false, error: "faltan campos del recordatorio" });
  }
  const { subject, html } = sessionReminderEmail(parts);
  const result = await sendMail({ to: to.trim(), cc: COPY_TO, subject, html });
  if (!result.sent) return res.status(502).json({ ok: false, error: result.reason || "no enviado", detail: result.error });
  console.log(`[reminderMail] Recordatorio de sesión enviado a ${to.trim()}.`);
  res.json({ ok: true });
});

module.exports = router;
