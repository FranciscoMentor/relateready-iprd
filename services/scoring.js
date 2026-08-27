// Motor de puntuación del Índice de Desarrollo y Fortalecimiento Relacional — TODO el cálculo vive aquí, en JS puro.
// La IA (services/aiAnalysis.js) nunca decide ni recalcula un resultado:
// solo redacta a partir de las variables que este archivo ya resolvió.
// Ver IPRD_especificacion_tecnica.docx, secciones 5 y 5bis.

const { DIMENSION_CODES, dimensionLabel } = require("../data/dimensions");
const { buildFlatCoreItems, buildFlatDesirabilityItems } = require("../data/items");
const { DISTRESS_KEYWORDS_ES, DISTRESS_KEYWORDS_EN } = require("../data/relationshipContexts");

const CORE_ITEMS_FLAT = buildFlatCoreItems();
const DESIRABILITY_ITEMS_FLAT = buildFlatDesirabilityItems();

function bandForIndex(index) {
  if (index >= 71) return "f";
  if (index >= 45) return "m";
  return "d";
}

/**
 * @param {Object} coreResponses  { AS01: 1-6, AS02: 1-6, ... } — 40 respuestas (5 por dimensión)
 * @param {Object} desirabilityResponses { DES01: 1-6, ... } — 6 respuestas
 * @returns {Object} resultado completo de puntuación
 */
function scoreTest(coreResponses, desirabilityResponses) {
  const dimensions = {};

  for (const code of DIMENSION_CODES) {
    const items = CORE_ITEMS_FLAT.filter((i) => i.dimension === code);
    const n = items.length; // ítems de esta dimensión (5 por defecto) — el rango
    // mín/máx posible de rawSum se deriva de n, así el índice 0-100 sigue siendo
    // correcto sin importar cuántos ítems tenga cada dimensión.
    let rawSum = 0;
    for (const item of items) {
      const raw = Number(coreResponses[item.id]);
      if (!Number.isInteger(raw) || raw < 1 || raw > 6) {
        throw new Error(`Respuesta inválida o faltante para el ítem ${item.id}`);
      }
      const coded = item.keying === "R" ? 7 - raw : raw;
      rawSum += coded;
    }
    const index = Math.round(((rawSum - n) / (n * 5)) * 100);
    dimensions[code] = {
      code,
      rawSum,
      index,
      band: bandForIndex(index),
    };
  }

  // Deseabilidad social: suma cruda de las 6 respuestas (rango 6-36).
  let desirabilityRaw = 0;
  for (const item of DESIRABILITY_ITEMS_FLAT) {
    const raw = Number(desirabilityResponses[item.id]);
    if (!Number.isInteger(raw) || raw < 1 || raw > 6) {
      throw new Error(`Respuesta inválida o faltante para el ítem ${item.id}`);
    }
    desirabilityRaw += raw;
  }
  const desirabilityFlag = desirabilityRaw >= 30;

  // Ordenar dimensiones por índice para fortalezas / áreas de desarrollo.
  const sorted = [...DIMENSION_CODES].sort((a, b) => dimensions[b].index - dimensions[a].index);
  const topStrengths = sorted.slice(0, 3);
  const topDevelopmentAreas = [...sorted].reverse().slice(0, 3);

  const overallAverage = Math.round(
    DIMENSION_CODES.reduce((sum, c) => sum + dimensions[c].index, 0) / DIMENSION_CODES.length
  );

  return {
    dimensions,
    desirability: { raw: desirabilityRaw, flag: desirabilityFlag },
    topStrengths,
    topDevelopmentAreas,
    overallAverage,
  };
}

/**
 * Protocolo de derivación — revisa tanto el patrón cuantitativo como el texto
 * libre del intake obligatorio "contexto relacional actual". Heurística
 * provisional; ver IPRD_especificacion_tecnica.docx, sección 7.
 */
function checkReferralProtocol(scoreResult, freeTextContext, lang) {
  const developmentCount = DIMENSION_CODES.filter(
    (c) => scoreResult.dimensions[c].band === "d"
  ).length;
  const quantitativeFlag = developmentCount >= 6 || scoreResult.overallAverage <= 25;

  const text = (freeTextContext || "").toLowerCase();
  const keywords = lang === "en" ? DISTRESS_KEYWORDS_EN : DISTRESS_KEYWORDS_ES;
  // Se revisan ambos listados por si la persona escribe en el otro idioma.
  const allKeywords = [...DISTRESS_KEYWORDS_ES, ...DISTRESS_KEYWORDS_EN];
  const textFlag = allKeywords.some((kw) => text.includes(kw));

  return {
    triggered: quantitativeFlag || textFlag,
    reason: textFlag ? "texto_libre" : quantitativeFlag ? "patron_cuantitativo" : null,
  };
}

module.exports = {
  scoreTest,
  checkReferralProtocol,
  bandForIndex,
  CORE_ITEMS_FLAT,
  DESIRABILITY_ITEMS_FLAT,
};
