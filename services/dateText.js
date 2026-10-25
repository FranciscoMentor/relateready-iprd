// services/dateText.js — fecha legible para los textos: "31 de octubre" (ES) o
// "October 31" (EN). Recibe AAAA-MM-DD y devuelve null si no es una fecha válida.
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function humanDate(isoDate, lang) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || ""));
  if (!m) return null;
  const month = Number(m[2]) - 1, day = Number(m[3]);
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  return lang === "en" ? `${MONTHS_EN[month]} ${day}` : `${day} de ${MONTHS_ES[month]}`;
}

module.exports = { humanDate };
