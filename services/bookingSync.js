// services/bookingSync.js
//
// Marca como "sesion_agendada" a quien reservó su sesión gratuita en Outlook
// Bookings. Lo usan dos caminos: el botón "Sincronizar" del panel (lee el
// calendario desde el navegador) y la tarea programada de recordatorios
// (/internal/booking-sync), que no depende de ninguna sesión abierta.
//
// IMPORTANTE: en las reservas de Bookings los "invitados" del evento son solo
// cuentas internas de Adamantine; el correo de la persona que reservó aparece
// únicamente en el texto del evento ("Customer Info … Email: …" o
// "Información del cliente … Correo electrónico: …"). Por eso se extrae de ahí.
const db = require("../db/init");

const STAFF_DOMAIN = "adamantinehealing.onmicrosoft.com";
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const BODY_EMAIL_RE = /(?:^|[\r\n>])\s*(?:e-?mail|correo(?:\s+electr[oó]nico)?)\s*:\s*([^\s<>"']+@[^\s<>"']+)/i;

function isStaff(email) {
  return String(email || "").toLowerCase().endsWith("@" + STAFF_DOMAIN);
}

// Devuelve el correo del cliente que aparece en el texto de una reserva de
// Bookings, o "" si no hay uno válido (o es de una cuenta interna).
function extractCustomerEmail(text) {
  const m = BODY_EMAIL_RE.exec(String(text || "").slice(0, 4000));
  if (!m) return "";
  const email = m[1].replace(/[.,;:)]+$/, "").trim().toLowerCase();
  return EMAIL_RE.test(email) && !isStaff(email) && email.length <= 200 ? email : "";
}

// events: [{ id, start, emails?: [], email?: "", text?: "" }]
// Si trae "text", el correo se extrae de ahí. Los correos internos se ignoran.
function applyBookingEvents(events) {
  const list = Array.isArray(events) ? events.slice(0, 1000) : [];
  const find = db.prepare("SELECT id, name, email, follow_up_status, follow_up_notes FROM submissions WHERE lower(email) = ? ORDER BY id DESC LIMIT 1");
  const upd = db.prepare("UPDATE submissions SET follow_up_status = 'sesion_agendada', follow_up_notes = ? WHERE id = ?");
  const matched = [];
  let alreadyKnown = 0, checked = 0, withEmail = 0;
  for (const ev of list) {
    if (!ev || typeof ev !== "object") continue;
    const when = String(ev.start || "").slice(0, 16).replace("T", " ");
    const tag = "Sesión agendada (Bookings): " + when + (ev.id ? " [" + String(ev.id).slice(-12) + "]" : "");
    const candidates = [];
    if (Array.isArray(ev.emails)) candidates.push(...ev.emails.slice(0, 10));
    if (ev.email) candidates.push(ev.email);
    if (ev.text) candidates.push(extractCustomerEmail(ev.text));
    const emails = [...new Set(candidates.map((r) => String(r || "").trim().toLowerCase()).filter((e) => e && e.length <= 200 && EMAIL_RE.test(e) && !isStaff(e)))];
    if (emails.length) withEmail++;
    for (const email of emails) {
      checked++;
      const row = find.get(email);
      if (!row) continue;
      if (row.follow_up_notes && ev.id && row.follow_up_notes.includes("[" + String(ev.id).slice(-12) + "]")) { alreadyKnown++; continue; }
      if (row.follow_up_status === "nuevo" || row.follow_up_status === "contactado") {
        upd.run((row.follow_up_notes ? row.follow_up_notes + "\n" : "") + tag, row.id);
        matched.push({ name: row.name, email: row.email, start: when });
      } else {
        alreadyKnown++;
      }
    }
  }
  return { eventsRead: withEmail, matched, alreadyKnown, checked };
}

module.exports = { applyBookingEvents, extractCustomerEmail, isStaff };
