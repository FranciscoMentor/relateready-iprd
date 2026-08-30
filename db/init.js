const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const DB_PATH = process.env.DB_PATH || "./db/relateready.sqlite";

// Asegura que el directorio del archivo exista (útil para el disco
// persistente de Render, montado en /var/data).
const dir = path.dirname(DB_PATH);
if (dir && dir !== "." && !fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    name TEXT NOT NULL,
    lang TEXT NOT NULL,
    gender TEXT NOT NULL,
    relationship_context_code TEXT NOT NULL,
    relationship_context_text TEXT NOT NULL,
    core_responses TEXT NOT NULL,
    desirability_responses TEXT NOT NULL,
    vignette_responses TEXT,
    qualitative_answers TEXT,
    score_result TEXT NOT NULL,
    referral_triggered INTEGER NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'pending',
    payment_reference TEXT,
    extended_generated_at TEXT
  );
`);

// ── Migraciones incrementales del panel-control (2026-08) ─────────────────
// Igual que hace el panel de referencia de SQ Assessment: se revisa qué
// columnas existen ya en la tabla antes de agregar, así este bloque es
// seguro de ejecutar en cada arranque del servidor, tanto en local como en
// cada despliegue nuevo en Render (nunca destruye datos existentes).
//
// Columnas nuevas:
//  - email / phone: para poder dar seguimiento comercial real por persona
//    desde el panel (antes solo existía "name"). Se agregan también al
//    formulario del test (routes/api.js + public/js/app.js) como opcionales.
//  - follow_up_status / follow_up_notes: estado de seguimiento comercial
//    editable desde el panel (chips + notas), mismo patrón que el panel de
//    referencia. "nuevo" es el estado inicial de cualquier envío existente.
const existingColumns = db.prepare("PRAGMA table_info(submissions)").all().map((c) => c.name);
function addColumnIfMissing(name, ddl) {
  if (!existingColumns.includes(name)) {
    db.exec(`ALTER TABLE submissions ADD COLUMN ${ddl}`);
    existingColumns.push(name);
  }
}
addColumnIfMissing("email", "email TEXT");
addColumnIfMissing("phone", "phone TEXT");
addColumnIfMissing("follow_up_status", "follow_up_status TEXT NOT NULL DEFAULT 'nuevo'");
addColumnIfMissing("follow_up_notes", "follow_up_notes TEXT");

module.exports = db;
