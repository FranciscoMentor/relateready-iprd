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
//   "Hill"…) se lista aparte y NO se modifica.
// - Se puede correr las veces que se quiera: la segunda vez no cambia nada.
// - Base de datos: DB_PATH, o ./db/relateready.sqlite. En Render vive en
//   /var/data/relateready.sqlite.
// (La misma lógica está disponible en la ruta protegida /internal/normalize-countries.)
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const { normalizeCountries } = require("../services/countryNormalize");

const DB_PATH = process.env.DB_PATH || "./db/relateready.sqlite";
const APPLY = process.argv.includes("--aplicar");

async function main() {
  if (!fs.existsSync(DB_PATH)) { console.error(`No existe la base de datos: ${DB_PATH}`); process.exit(1); }
  const db = new Database(DB_PATH, { fileMustExist: true });
  const r = await normalizeCountries(db, { apply: APPLY, dbPath: DB_PATH });

  console.log(`Base de datos: ${path.resolve(DB_PATH)}`);
  console.log(`Modo: ${APPLY ? "APLICAR" : "SIMULACIÓN (no se cambia nada)"}\n`);
  console.log("Valores de país encontrados:");
  r.values.forEach((v) => {
    const label = v.raw === "" ? "(vacío)" : `"${v.raw}"`;
    console.log(`  ${String(v.count).padStart(4)}  ${label.padEnd(28)} -> ${v.canon ? `"${v.canon}"${v.canon === v.raw ? "  (ya está bien)" : ""}` : "NO RECONOCIDO (no se toca)"}`);
  });
  console.log("\nTotales por país después de normalizar:");
  r.totals.forEach((t) => console.log(`  ${String(t.count).padStart(4)}  ${t.country}`));
  console.log(`\nNo reconocidos (${r.unknown.length}) — revisar a mano, no se modifican:`);
  if (!r.unknown.length) console.log("  (ninguno)");
  r.unknown.forEach((u) => console.log(`  id=${u.id} | país="${u.country || ""}" | ${u.name || ""} | ${u.email || ""} | ciudad=${u.city || ""} | estado=${u.state || ""} | tel=${u.phone || ""}`));
  console.log(`\nFilas que cambiarían: ${r.wouldChange}`);
  if (!APPLY) { console.log("Simulación: no se cambió nada. Para aplicar: node scripts/normalizar-paises.js --aplicar"); return; }
  if (!r.changed) { console.log("Nada que cambiar."); return; }
  console.log(`Copia de seguridad creada: ${r.backup}`);
  console.log(`Listo: ${r.changed} filas actualizadas.`);
}

main().catch((e) => { console.error("Error:", e.message); process.exit(1); });
