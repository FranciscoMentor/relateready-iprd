// routes/countryNormalize.js
//
// Ruta protegida (x-reminder-key = REMINDER_API_KEY) que ejecuta la misma
// normalización de países que scripts/normalizar-paises.js, para poder correrla
// sin el Shell de Render. POST {"apply": false} simula; {"apply": true} hace copia
// de seguridad de la base y actualiza solo las filas con país reconocido.
const express = require("express");
const crypto = require("crypto");
const db = require("../db/init");
const { normalizeCountries } = require("../services/countryNormalize");

const router = express.Router();

function keyMatches(given, expected) {
  const a = crypto.createHash("sha256").update(String(given || "")).digest();
  const b = crypto.createHash("sha256").update(String(expected || "")).digest();
  return crypto.timingSafeEqual(a, b);
}

router.post("/", express.json({ limit: "8kb" }), async (req, res) => {
  const expected = process.env.REMINDER_API_KEY;
  if (!expected) return res.status(503).json({ ok: false, error: "REMINDER_API_KEY no configurada" });
  if (!keyMatches(req.get("x-reminder-key"), expected)) return res.status(401).json({ ok: false, error: "clave inválida" });
  try {
    const report = await normalizeCountries(db, { apply: !!(req.body && req.body.apply === true), dbPath: process.env.DB_PATH || "./db/relateready.sqlite" });
    res.json({ ok: true, ...report });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
