// services/location.js
//
// Ubicación de quien hace el test: ciudad + país, y además ESTADO cuando el
// país es Estados Unidos (sirve para deducir la zona horaria de los
// recordatorios sin pedir una dirección completa).

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "District of Columbia",
  "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine",
  "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
  "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
  "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia",
  "Washington", "West Virginia", "Wisconsin", "Wyoming",
];

function norm(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z]/g, "");
}

const US_NAMES = new Set(["us", "usa", "unitedstates", "unitedstatesofamerica", "eeuu", "estadosunidos", "estadosunidosdeamerica", "estadosunidosdenorteamerica"]);

// true si el texto del país significa Estados Unidos (USA, EE.UU., Estados Unidos…).
function isUnitedStates(country) {
  return US_NAMES.has(norm(country));
}

// Devuelve el nombre oficial del estado (ej. "kentucky" -> "Kentucky") o "" si no existe.
function canonicalState(input) {
  const n = norm(input);
  if (!n) return "";
  return US_STATES.find((s) => norm(s) === n) || "";
}

// ── País con un nombre único ────────────────────────────────────────────────
// canonicalCountry("USA" | "Estados Unidos" | "EE.UU." | "México" | "UK"…) devuelve
// el nombre único en inglés ("United States", "Mexico", "United Kingdom"…) o ""
// si el texto no es un país reconocido. La lista sale de Intl.DisplayNames de
// Node (regiones ISO, en inglés y en español, requiere ICU completo — viene en
// los binarios oficiales de Node que usa Render) más algunos alias.
const NOT_COUNTRIES = new Set(["EU", "UN", "EZ", "ZZ", "XA", "XB", "AC", "CP", "DG", "EA", "IC", "TA", "QO"]);
const COUNTRY_ALIASES = {
  usa: "United States", us: "United States", eeuu: "United States", unitedstatesofamerica: "United States",
  estadosunidosdeamerica: "United States", estadosunidosdenorteamerica: "United States",
  uk: "United Kingdom", greatbritain: "United Kingdom", granbretana: "United Kingdom", inglaterra: "United Kingdom",
  england: "United Kingdom", escocia: "United Kingdom", scotland: "United Kingdom",
  holanda: "Netherlands", paisesbajos: "Netherlands",
  republicadominicana: "Dominican Republic", corea: "South Korea", coreadelsur: "South Korea",
};

let countryIndex = null;
const spanishNames = new Map(); // nombre en inglés -> nombre en español (para mostrar en el panel)
function buildCountryIndex() {
  const index = new Map();
  const en = new Intl.DisplayNames(["en"], { type: "region" });
  const es = new Intl.DisplayNames(["es"], { type: "region" });
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (const a of A) {
    for (const b of A) {
      const code = a + b;
      if (NOT_COUNTRIES.has(code)) continue;
      let nameEn, nameEs;
      try { nameEn = en.of(code); nameEs = es.of(code); } catch (e) { continue; }
      if (!nameEn || nameEn === code || /unknown|desconocid/i.test(nameEn)) continue;
      if (nameEs) spanishNames.set(nameEn, nameEs);
      for (const n of [nameEn, nameEs]) {
        const key = norm(n);
        if (key && !index.has(key)) index.set(key, nameEn);
      }
    }
  }
  for (const [alias, name] of Object.entries(COUNTRY_ALIASES)) index.set(alias, name);
  return index;
}

function canonicalCountry(input) {
  const key = norm(input);
  if (!key) return "";
  if (!countryIndex) countryIndex = buildCountryIndex();
  return countryIndex.get(key) || "";
}

// Nombre en español de un país ya canónico ("United States" -> "Estados Unidos").
function countryNameEs(canonical) {
  if (!canonical) return "";
  if (!countryIndex) countryIndex = buildCountryIndex();
  return spanishNames.get(canonical) || canonical;
}

module.exports = { US_STATES, isUnitedStates, canonicalState, canonicalCountry, countryNameEs };
