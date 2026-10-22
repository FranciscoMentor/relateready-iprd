// services/promo.js
//
// Promoción vigente del Informe Extendido gratis con un clic (relanzamiento de
// la campaña, 26 de octubre de 2026). El código promocional NUNCA sale del
// servidor: el navegador solo sabe si hay promoción activa y hasta cuándo, y
// pide el canje con un clic (POST /api/promo/redeem); el servidor aplica el
// código aquí.
//
// La promoción está activa solo si se cumplen las dos condiciones:
//   1. el código promocional sigue en FREE_ACCESS_CODES (variable de Render:
//      al quitar TEST999 el 1 de noviembre la promoción se apaga sola), y
//   2. la fecha actual no pasa del final del 31 de octubre de 2026.
// Esta variable NO se modifica desde aquí; solo se lee.

const { isValidAccessCode, normalizeCode } = require("./accessCodes");

// Código de la promoción. Se puede cambiar con la variable PROMO_CODE (opcional);
// por defecto, TEST999.
const PROMO_CODE = normalizeCode(process.env.PROMO_CODE || "TEST999");

// Fin de la promoción: 31 de octubre de 2026 a las 23:59 hora del Pacífico de
// EE. UU. (el último huso del mercado), es decir, 1 de noviembre 08:00 UTC.
const PROMO_ENDS_AT = Date.parse(process.env.PROMO_ENDS_AT || "2026-11-01T08:00:00Z");
const PROMO_UNTIL_LABEL = "2026-10-31";

function promoActive(now = Date.now()) {
  return isValidAccessCode(PROMO_CODE) && Number.isFinite(PROMO_ENDS_AT) && now < PROMO_ENDS_AT;
}

// Límite de peticiones muy básico en memoria: máximo `max` por ventana, por clave.
function makeRateLimiter(max, windowMs) {
  const hits = new Map();
  return function allow(key) {
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) { hits.set(key, arr); return false; }
    arr.push(now);
    hits.set(key, arr);
    if (hits.size > 5000) { for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k); }
    return true;
  };
}

module.exports = { PROMO_CODE, PROMO_UNTIL_LABEL, promoActive, makeRateLimiter };
