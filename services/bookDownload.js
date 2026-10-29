// services/bookDownload.js
//
// Libro digital de regalo "Tú Primero" (ES) / "You First" (EN) para quien compró
// el Informe Extendido.
//
//  - Los PDF viven en private/books/ (carpeta que NO se sirve como archivos
//    públicos: solo se entregan por la ruta GET /api/book/:id con un enlace firmado).
//  - Enlace firmado: "<vence>.<firma>", con firma HMAC-SHA256 del id del informe y la
//    fecha de vencimiento. Vale BOOK_LINK_DAYS días (30) desde que se genera. El
//    correo del informe trae uno nuevo; la pantalla de resultados genera otro cada
//    vez que se abre, así que quien pierde el correo nunca se queda sin libro.
//  - Quién tiene derecho: informe pagado (Payphone o marcado como pagado a mano en
//    el panel). Quien desbloqueó con código gratis no recibe el libro por este
//    camino (sigue como antes: el libro se entrega en la sesión).
//  - Idioma: el del informe de la persona.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const db = require("../db/init");

const BOOK_LINK_DAYS = 30;
const BOOKS = {
  es: { file: path.join(__dirname, "..", "private", "books", "tu-primero-es.pdf"), name: "Tú Primero - RelateReady.pdf" },
  en: { file: path.join(__dirname, "..", "private", "books", "you-first-en.pdf"), name: "You First - RelateReady.pdf" },
};

function secret() {
  return String(process.env.BOOK_LINK_SECRET || process.env.SESSION_SECRET || "cambia-esto-en-produccion");
}

function sign(subId, exp) {
  return crypto.createHmac("sha256", secret()).update(`book:${subId}:${exp}`).digest("base64url");
}

/** ¿Esta persona tiene derecho al libro? (informe pagado o simulado, no código gratis) */
function entitled(sub) {
  return !!sub && (sub.payment_status === "paid" || sub.payment_status === "simulated");
}

/** Token firmado "<vence>.<firma>" que vale `days` días desde `now`. */
function makeToken(subId, now = Date.now(), days = BOOK_LINK_DAYS) {
  const exp = Math.floor(now / 1000) + days * 86400;
  return `${exp}.${sign(subId, exp)}`;
}

/** true si el token es de este informe, la firma es válida y no venció. */
function verifyToken(subId, token, now = Date.now()) {
  const [expStr, sig] = String(token || "").split(".");
  const exp = Number(expStr);
  if (!Number.isInteger(exp) || !sig) return false;
  if (exp * 1000 < now) return false;
  const good = sign(subId, exp);
  const a = Buffer.from(sig), b = Buffer.from(good);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Enlace de descarga para un informe (o null si no tiene derecho al libro). */
function bookUrlFor(sub, baseUrl, now = Date.now()) {
  if (!entitled(sub)) return null;
  return `${baseUrl}/api/book/${encodeURIComponent(sub.id)}?t=${makeToken(sub.id, now)}`;
}

function bookFor(lang) {
  const b = BOOKS[lang === "en" ? "en" : "es"];
  return fs.existsSync(b.file) ? b : null;
}

/** Registra la descarga: primera fecha y contador (para el panel). */
function recordDownload(subId) {
  db.prepare(
    "UPDATE submissions SET book_downloaded_at = COALESCE(book_downloaded_at, ?), book_download_count = COALESCE(book_download_count, 0) + 1 WHERE id = ?"
  ).run(new Date().toISOString(), subId);
}

module.exports = { BOOK_LINK_DAYS, entitled, makeToken, verifyToken, bookUrlFor, bookFor, recordDownload };
