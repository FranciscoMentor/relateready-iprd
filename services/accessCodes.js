// services/accessCodes.js
//
// Códigos de acceso gratuito (códigos VIP) que desbloquean el Informe
// Extendido sin pagar. Se configuran en Render → Environment, variable
// FREE_ACCESS_CODES, separados por coma (ej. "PANEL2026,BETA-ADAMANTINE").
// No distinguen mayúsculas/minúsculas. Vacío = ningún código es válido.
//
// Los usan: el canje en la pantalla de resultados (routes/api.js) y el correo
// de invitación al test con código VIP (routes/admin.js, sección "Invitar").

const FREE_ACCESS_CODES = (process.env.FREE_ACCESS_CODES || "")
  .split(",")
  .map((c) => c.trim().toUpperCase())
  .filter(Boolean);

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

function isValidAccessCode(code) {
  const c = normalizeCode(code);
  return !!c && FREE_ACCESS_CODES.includes(c);
}

module.exports = { FREE_ACCESS_CODES, normalizeCode, isValidAccessCode };
