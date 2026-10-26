// services/countryNormalize.js
//
// Lógica compartida para dejar el país de los envíos viejos con un nombre único
// ("USA", "Usa", "EE.UU." -> "United States"). La usan scripts/normalizar-paises.js
// (línea de comandos) y la ruta protegida /internal/normalize-countries.
//
// - Solo actualiza filas con un país reconocido; lo demás se lista aparte y no se toca.
// - apply=false (por defecto): solo simula.
// - apply=true: primero hace una copia de seguridad de la base y luego actualiza.
// - Idempotente: la segunda vez no cambia nada.
const path = require("path");
const { canonicalCountry } = require("./location");

async function normalizeCountries(db, { apply = false, dbPath = "" } = {}) {
  const rows = db.prepare("SELECT id, name, email, phone, city, state, country FROM submissions").all();
  const groups = new Map();
  const unknown = [];
  const toChange = [];
  for (const r of rows) {
    const raw = r.country === null || r.country === undefined ? "" : String(r.country);
    const canon = canonicalCountry(raw);
    const g = groups.get(raw) || { count: 0, canon };
    g.count += 1;
    groups.set(raw, g);
    if (!canon) { unknown.push(r); continue; }
    if (raw !== canon) toChange.push(r.id);
  }
  const values = [...groups.entries()].sort((a, b) => b[1].count - a[1].count).map(([raw, g]) => ({ raw, count: g.count, canon: g.canon || null }));
  const totals = new Map();
  for (const g of groups.values()) if (g.canon) totals.set(g.canon, (totals.get(g.canon) || 0) + g.count);
  const report = {
    mode: apply ? "aplicar" : "simulacion",
    values,
    totals: [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([country, count]) => ({ country, count })),
    unknown,
    wouldChange: toChange.length,
    changed: 0,
    backup: null,
  };
  if (!apply || !toChange.length) return report;

  const base = path.resolve(dbPath || db.name);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = path.join(path.dirname(base), `${path.basename(base, path.extname(base))}.antes-de-paises-${stamp}${path.extname(base) || ".sqlite"}`);
  await db.backup(backup);
  report.backup = backup;

  const upd = db.prepare("UPDATE submissions SET country = ? WHERE id = ?");
  const byId = new Map(rows.map((r) => [r.id, r]));
  db.transaction(() => { for (const id of toChange) upd.run(canonicalCountry(byId.get(id).country), id); })();
  report.changed = toChange.length;
  return report;
}

module.exports = { normalizeCountries };
