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

module.exports = { US_STATES, isUnitedStates, canonicalState };
