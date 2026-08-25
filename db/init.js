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

module.exports = db;
