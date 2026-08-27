// 8 dimensiones del Índice de Desarrollo y Fortalecimiento Relacional. El orden aquí es el orden canónico usado en todo
// el sistema (radar, informe, base de datos).
const DIMENSIONS = [
  { code: "AS", es: "Seguridad de apego", en: "Attachment Security" },
  { code: "DS", es: "Diferenciación del self", en: "Self-Differentiation" },
  { code: "RS", es: "Manejo de la sensibilidad al rechazo", en: "Rejection Sensitivity Management" },
  { code: "CG", es: "Creencias de crecimiento relacional", en: "Relationship Growth Beliefs" },
  { code: "CR", es: "Comunicación y reparación", en: "Communication & Repair Skills" },
  { code: "AR", es: "Autoestima relacional", en: "Relational Self-Esteem" },
  { code: "IA", es: "Intimidad y apertura", en: "Intimacy & Openness Capacity" },
  { code: "CV", es: "Claridad de valores y proyecto de vida", en: "Values & Life-Plan Clarity" },
];

const DIMENSION_CODES = DIMENSIONS.map((d) => d.code);

function dimensionLabel(code, lang) {
  const d = DIMENSIONS.find((x) => x.code === code);
  return d ? d[lang] : code;
}

module.exports = { DIMENSIONS, DIMENSION_CODES, dimensionLabel };
