// services/promo.js
//
// Promoción vigente del Informe Extendido gratis con un clic. NO hay códigos ni
// fechas escritos en el programa: todo sale de la pestaña "Campañas con código"
// del panel (tabla campaigns). Una promoción está vigente cuando:
//   1. la campaña tiene activado "Botón de un clic" (one_click),
//   2. hoy (hora de Ecuador, UTC-5, la misma que usa el panel) está entre su
//      fecha "Desde" y su fecha "Hasta", ambas inclusive, y
//   3. su código sigue en FREE_ACCESS_CODES (variable de Render). Si quitas el
//      código de Render, la promoción se apaga sola aunque la fecha no haya pasado.
// El código NUNCA sale del servidor: el navegador solo sabe si hay promoción
// activa, y pide el canje con un clic (POST /api/promo/redeem). Esta variable
// de Render solo se lee, nunca se modifica desde aquí.
//
// Para una promoción nueva: (1) agrega el código nuevo a FREE_ACCESS_CODES en
// Render, (2) crea una campaña en el panel con ese código, las fechas y el
// botón de un clic activado, y (3) publica el anuncio en Meta. No hay que
// cambiar ni subir código.

const db = require("../db/init");
const { isValidAccessCode, normalizeCode } = require("./accessCodes");

const TZ_OFFSET_HOURS = -5; // Ecuador, igual que routes/campaignCode.js

function todayEcuador(now = Date.now()) {
  return new Date(now + TZ_OFFSET_HOURS * 3600000).toISOString().slice(0, 10);
}

/** Devuelve { code, until, name } de la promoción vigente, o null si no hay ninguna. */
function getActivePromo(now = Date.now()) {
  let rows;
  try {
    rows = db.prepare("SELECT name, code, date_from, date_to FROM campaigns WHERE one_click = 1 ORDER BY id DESC").all();
  } catch (e) {
    console.error("[promo] No se pudo leer la tabla campaigns —", e.message);
    return null;
  }
  const today = todayEcuador(now);
  for (const r of rows) {
    const code = normalizeCode(r.code);
    if (code && isValidAccessCode(code) && today >= r.date_from && today <= r.date_to) {
      return { code, until: r.date_to, name: r.name };
    }
  }
  return null;
}

function promoActive(now = Date.now()) {
  return !!getActivePromo(now);
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

module.exports = { getActivePromo, promoActive, makeRateLimiter };
