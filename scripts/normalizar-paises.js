#!/usr/bin/env node
// scripts/normalizar-paises.js
//
// Deja el país de los envíos viejos con un nombre único ("USA", "Usa",
// "EE.UU." -> "United States"), igual que lo guarda ahora el test.
//
//   node scripts/normalizar-paises.js            -> SIMULA: no cambia nada
//   node scripts/normalizar-paises.js --aplicar  -> hace copia de seguridad y cambia
//
// - Solo actualiza filas con un país reconocido. Lo que no se reconoce ("Linn",
//   "Hill"…) se lista aparte con id, nombre, correo, ciudad, estado y teléfono y
//   NO se modifica.
// - Se puede correr las veces que se quiera: la segunda vez no cambia nada.
// - Base de datos: DB_PATH, o ./db/relateready.sqlite. En Render vive en
//   /var/data/relateready.sqlite (DB_PATH ya está configurada en el servicio,
//   así que basta correr el comando en la pestaña Shell).
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const { canonicalCountry } = require("../services/location");

const DB_PATH = process.env.DB_PATH || "./db/relateready.sqlite";
const APPLY = process.argv.includes("--aplicar");

async function main() {
  if (!fs.existsSync(DB_PATH)) { console.error(`No existe la base de datos: ${DB_PATH}`); process.exit(1); }
  const db = new Database(DB_PATH, { fileMustExist: true });
  const rows = db.prepare("SELECT id, name, email, phone, city, state, country FROM submissions").all();

  const groups = new Map(); // valor original -> { count, canon }
  const unknown = [];
  const toChange = [];
  for (const r of rows) {
    const raw = r.country === null || r.country === undefined ? "" : String(r.country);
    const canon = canonicalCountry(raw);
    const g = groups.get(raw) || { count: 0, canon };
    g.count += 1; groups.set(raw, g);
    if (!canon) { unknown.push(r); continue; }
    if (raw !== canon) toChange.push(r.id);
  }

  console.log(`Base de datos: ${path.resolve(DB_PATH)}`);
  console.log(`Modo: ${APPLY ? "APLICAR" : "SIMULACIÓN (no se cambia nada)"}\n`);
  console.log("Valores de país encontrados:");
  [...groups.entries()].sort((a, b) => b[1].count - a[1].count).forEach(([raw, g]) => {
    const label = raw === "" ? "(vacío)" : `"${raw}"`;
    console.log(`  ${String(g.count).padStart(4)}  ${label.padEnd(28)} -> ${g.canon ? `"${g.canon}"${g.canon === raw ? "  (ya está bien)" : ""}` : "NO RECONOCIDO (no se toca)"}`);
  });

  const byCanon = new Map();
  for (const g of groups.values()) if (g.canon) byCanon.set(g.canon, (byCanon.get(g.canon) || 0) + g.count);
  console.log("\nTotales por país después de normalizar:");
  [...byCanon.entries()].sort((a, b) => b[1] - a[1]).forEach(([c, n]) => console.log(`  ${String(n).padStart(4)}  ${c}`));

  console.log(`\nNo reconocidos (${unknown.length}) — revisar a mano, no se modifican:`);
  if (!unknown.length) console.log("  (ninguno)");
  unknown.forEach((r) => console.log(`  id=${r.id} | país="${r.country || ""}" | ${r.name || ""} | ${r.email || ""} | ciudad=${r.city || ""} | estado=${r.state || ""} | tel=${r.phone || ""}`));

  console.log(`\nFilas que cambiarían: ${toChange.length}`);
  if (!APPLY) {
    console.log("Simulación: no se cambió nada. Para aplicar: node scripts/normalizar-paises.js --aplicar");
    return;
  }
  if (!toChange.length) { console.log("Nada que cambiar."); return; }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = path.join(path.dirname(path.resolve(DB_PATH)), `${path.basename(DB_PATH, path.extname(DB_PATH))}.antes-de-paises-${stamp}${path.extname(DB_PATH) || ".sqlite"}`);
  await db.backup(backup);
  console.log(`Copia de seguridad creada: ${backup}`);

  const upd = db.prepare("UPDATE submissions SET country = ? WHERE id = ?");
  const byId = new Map(rows.map((r) => [r.id, r]));
  const run = db.transaction(() => { for (const id of toChange) upd.run(canonicalCountry(byId.get(id).country), id); });
  run();
  console.log(`Listo: ${toChange.length} filas actualizadas.`);
}

main().catch((e) => { console.error("Error:", e.message); process.exit(1); });
