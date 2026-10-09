#!/usr/bin/env node
// scripts/restore-backup.js
//
// Restaura un respaldo (.sqlite.gz) generado por services/backupService.js
// (el que llega por correo cada semana o se descarga desde el panel).
//
// Uso:
//   node scripts/restore-backup.js <respaldo.sqlite.gz> [archivo-destino]
//
// Si no se indica destino, usa DB_PATH (en Render: /var/data/relateready.sqlite).
// Antes de tocar nada: descomprime a un archivo temporal, abre la copia y
// comprueba PRAGMA integrity_check. Si el destino ya existe NO lo borra: lo
// renombra a "<destino>.antes-de-restaurar-<fecha>" para poder volver atrás.
//
// Cómo restaurar en Render (Dashboard → tu servicio → Shell):
//   1. Sube el .sqlite.gz al servicio (o descárgalo desde un enlace privado) a /tmp.
//   2. Detén el servicio (Suspend) para que nadie escriba mientras restauras —
//      si el Shell no está disponible con el servicio suspendido, restaura y
//      reinicia de inmediato (Manual Deploy → Restart).
//   3. node scripts/restore-backup.js /tmp/relateready-respaldo-AAAA-MM-DD.sqlite.gz
//   4. Reanuda / reinicia el servicio.
//
// Para probar sin riesgo en tu computador: indica un destino distinto, por
// ejemplo   node scripts/restore-backup.js respaldo.sqlite.gz ./prueba.sqlite

const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");

function fail(msg) {
  console.error("✗ " + msg);
  process.exit(1);
}

const [, , source, destArg] = process.argv;
if (!source) fail("Uso: node scripts/restore-backup.js <respaldo.sqlite.gz> [archivo-destino]");
if (!fs.existsSync(source)) fail(`No existe el archivo: ${source}`);

const dest = path.resolve(destArg || process.env.DB_PATH || "./db/relateready.sqlite");
const tmp = path.join(os.tmpdir(), `relateready-restore-${process.pid}.sqlite`);

try {
  fs.writeFileSync(tmp, zlib.gunzipSync(fs.readFileSync(source)));
} catch (err) {
  fail("No se pudo descomprimir el respaldo (¿está completo y es un .sqlite.gz?): " + err.message);
}

const Database = require("better-sqlite3");
let counts = {};
try {
  const check = new Database(tmp, { readonly: true, fileMustExist: true });
  const integrity = check.pragma("integrity_check", { simple: true });
  if (integrity !== "ok") {
    check.close();
    fs.unlinkSync(tmp);
    fail(`El respaldo está dañado (integrity_check: ${integrity}). No se restauró nada.`);
  }
  for (const t of ["submissions", "sd_events", "sd_attendees", "sd_votes", "sd_matches", "sd_survey_responses", "test_invitations"]) {
    try { counts[t] = check.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c; } catch (e) { /* tabla ausente */ }
  }
  check.close();
} catch (err) {
  try { fs.unlinkSync(tmp); } catch (e) { /* noop */ }
  fail("No se pudo abrir el respaldo como base de datos SQLite: " + err.message);
}

if (fs.existsSync(dest)) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupOfCurrent = `${dest}.antes-de-restaurar-${stamp}`;
  fs.renameSync(dest, backupOfCurrent);
  for (const suffix of ["-wal", "-shm"]) {
    if (fs.existsSync(dest + suffix)) fs.renameSync(dest + suffix, backupOfCurrent + suffix);
  }
  console.log(`• La base actual se conservó en: ${backupOfCurrent}`);
}
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(tmp, dest);
fs.unlinkSync(tmp);

console.log(`✓ Respaldo restaurado en: ${dest}`);
for (const [t, c] of Object.entries(counts)) console.log(`   ${t}: ${c}`);
console.log("Reinicia el servicio para que use la base restaurada.");
