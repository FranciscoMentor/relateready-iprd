// Dato de intake obligatorio #2: contexto relacional actual.
// Ver IPRD_especificacion_tecnica.docx, sección 2, e
// IPRD_puntuacion_e_interpretacion.docx, "Arquitectura de personalización por IA".
// Selección obligatoria de una de estas opciones + campo de texto libre
// obligatorio (ver campo "contexto_texto_libre" en el formulario).
const RELATIONSHIP_CONTEXTS = [
  { code: "soltero_tiempo", es: "Soltero/a hace tiempo, buscando desde cero", en: "Single for a while, starting from scratch" },
  { code: "ruptura_reciente", es: "Saliendo de una ruptura reciente", en: "Recovering from a recent breakup" },
  { code: "primeras_citas", es: "En las primeras citas con alguien", en: "On early dates with someone" },
  { code: "relacion_reciente", es: "En una relación reciente (menos de 6 meses)", en: "In a recent relationship (under 6 months)" },
  { code: "relacion_necesita_mejorar", es: "En una relación actual que necesita mejorar", en: "In a current relationship that needs work" },
  { code: "relaciones_cortas", es: "Después de varias relaciones cortas que no prosperan", en: "After several short relationships that didn't work out" },
  { code: "retomando", es: "Volviendo a intentarlo tras mucho tiempo sin buscar pareja", en: "Trying again after a long time not dating" },
  // Añadidos 2026-10: el público (p. ej. mujeres 45+) también está en pareja
  // estable, separado/a, divorciado/a o viudo/a. Los códigos antiguos siguen
  // siendo válidos (hay envíos guardados con ellos).
  { code: "pareja_estable", es: "En una relación o matrimonio estable, y quiero fortalecerlo", en: "In a stable relationship or marriage, and I want to strengthen it" },
  { code: "separado_proceso", es: "Separado/a o en proceso de separación", en: "Separated or going through a separation" },
  { code: "divorciado", es: "Divorciado/a, reconstruyéndome", en: "Divorced and rebuilding" },
  { code: "viudo", es: "Viudo/a, abriéndome a una nueva etapa", en: "Widowed and opening to a new chapter" },
  { code: "otra", es: "Otra situación (especificar en el campo de abajo)", en: "Another situation (specify in the field below)" },
];

// Agrupa cada contexto para adaptar el tono del informe (PDF + prompts de IA).
//   buscando   → soltero/a o saliendo con alguien: el "próximo vínculo" es futuro
//   en_pareja  → ya tiene una relación que quiere cuidar/mejorar
//   reconstruyendo → separado/a, divorciado/a, viudo/a, tras una ruptura
//   abierto    → "otra" o código desconocido: redacción neutra
const CONTEXT_GROUPS = {
  soltero_tiempo: "buscando",
  primeras_citas: "buscando",
  relaciones_cortas: "buscando",
  retomando: "buscando",
  relacion_reciente: "en_pareja",
  relacion_necesita_mejorar: "en_pareja",
  pareja_estable: "en_pareja",
  ruptura_reciente: "reconstruyendo",
  separado_proceso: "reconstruyendo",
  divorciado: "reconstruyendo",
  viudo: "reconstruyendo",
};
function contextGroup(code) {
  return CONTEXT_GROUPS[code] || "abierto";
}

// Palabras clave simples para el cribado de riesgo del protocolo de derivación
// sobre el campo de texto libre (ver services/scoring.js -> checkReferralProtocol).
// Heurística provisional — a refinar con criterio profesional antes de producción
// (ver IPRD_especificacion_tecnica.docx, sección 7).
const DISTRESS_KEYWORDS_ES = [
  "suicid", "quitarme la vida", "no quiero vivir", "hacerme daño", "autolesion",
  "no vale la pena vivir", "quiero morir", "no aguanto más", "no puedo más",
];
const DISTRESS_KEYWORDS_EN = [
  "suicid", "self harm", "self-harm", "want to die", "kill myself",
  "can't go on", "not worth living",
];

module.exports = { RELATIONSHIP_CONTEXTS, contextGroup, DISTRESS_KEYWORDS_ES, DISTRESS_KEYWORDS_EN };
