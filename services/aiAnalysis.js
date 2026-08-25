// Las 5 secciones del Informe Extendido generadas por IA.
// Ver IPRD_puntuacion_e_interpretacion.docx, "Arquitectura de personalización
// por IA", para las plantillas de prompt originales en las que se basa este
// archivo (equivalente funcional de aiAnalysis.js en Adamantine SQ Personal).
//
// REGLA NO NEGOCIABLE: este archivo NUNCA calcula ni decide un resultado
// (banda, índice, top/bottom dimensión). Todas esas variables ya llegan
// resueltas desde services/scoring.js — aquí solo se redacta con ellas.
//
// Si ANTHROPIC_API_KEY no está configurada, cada función devuelve un texto
// de marcador de posición (modo simulado) para poder probar el flujo
// completo sin gastar créditos ni requerir la clave todavía.

const Anthropic = require("@anthropic-ai/sdk");
const { dimensionLabel } = require("../data/dimensions");

const MOCK_MODE = !process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";

const client = MOCK_MODE ? null : new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function callClaude(systemPrompt, userPrompt, maxTokens = 500) {
  if (MOCK_MODE) {
    return `[Texto de ejemplo — modo simulado, ANTHROPIC_API_KEY no configurada. En producción, aquí aparece el párrafo real generado por Claude siguiendo este prompt: "${userPrompt.slice(0, 140)}..."]`;
  }
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    return msg.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
  } catch (err) {
    console.error("aiAnalysis: error llamando a Claude —", err.message);
    return null; // el llamador decide el texto de respaldo
  }
}

function fmtDim(code, lang, index) {
  return `${dimensionLabel(code, lang)} (${index}/100)`;
}

function fmtList(codes, lang, dimensions) {
  return codes.map((c) => fmtDim(c, lang, dimensions[c].index)).join(", ");
}

const SYSTEM_ES =
  "Eres un mentor cálido, cercano y no clínico especializado en preparación relacional para la marca RelateReady (IPRD). " +
  "Nunca diagnosticas, nunca prometes resultados, nunca usas nombres de marca de terceros. " +
  "No repitas fórmulas genéricas: cada persona debe sentir que este texto fue escrito específicamente para ella.";
const SYSTEM_EN =
  "You are a warm, close, non-clinical mentor specialized in relationship readiness for the RelateReady (IPRD) brand. " +
  "You never diagnose, never promise outcomes, never use third-party brand names. " +
  "Avoid generic formulas: each person should feel this text was written specifically for them.";

/**
 * @param {Object} p
 * @param {string} p.name
 * @param {"es"|"en"} p.lang
 * @param {"M"|"F"|"N"} p.gender
 * @param {string} p.relationshipContextLabel   etiqueta legible del contexto elegido
 * @param {string} p.relationshipContextText    texto libre obligatorio del intake
 * @param {Object} p.scoreResult                salida de services/scoring.js -> scoreTest()
 * @param {Object} p.bandContentByCode           { AS: {text, recommendations, bandLabel}, ... } ya resuelto por género
 * @param {string[]} [p.qualitativeAnswers]
 */
async function generateAISections(p) {
  const { name, lang, relationshipContextLabel, relationshipContextText, scoreResult, bandContentByCode, qualitativeAnswers } = p;
  const system = lang === "en" ? SYSTEM_EN : SYSTEM_ES;
  const dims = scoreResult.dimensions;
  const [topStrength, ...restStrengths] = scoreResult.topStrengths;
  const [topDevArea, ...restDevAreas] = scoreResult.topDevelopmentAreas;

  const topStrengthLabel = fmtDim(topStrength, lang, dims[topStrength].index);
  const topDevAreaLabel = fmtDim(topDevArea, lang, dims[topDevArea].index);

  // 1. Lectura integral del perfil
  const integralPrompt =
    lang === "en"
      ? `Write an "Integral reading of your profile" for ${name}. It should sound like the opening of a first mentoring conversation, not a technical report. Don't mention scores or percentages. Use the name at the start. Take into account their current relationship context: "${relationshipContextLabel} — ${relationshipContextText}". Weave in — without using technical labels — their top strength (${topStrengthLabel}) and top development area (${topDevAreaLabel}). Write 150-200 words. Close with a line that invites reading on.`
      : `Escribe una "Lectura integral de tu perfil" para ${name}. Debe sonar como la apertura de una primera conversación de acompañamiento, no como un reporte técnico. No menciones puntajes ni porcentajes. Usa el nombre al inicio. Ten en cuenta su contexto relacional actual: "${relationshipContextLabel} — ${relationshipContextText}". Integra —sin usar etiquetas técnicas— su fortaleza principal (${topStrengthLabel}) y su área de desarrollo principal (${topDevAreaLabel}). Escribe entre 150 y 200 palabras. Cierra con una frase que invite a seguir leyendo.`;

  // 2. Síntesis de fortalezas combinadas
  const strengthsPrompt =
    lang === "en"
      ? `Based on ${name}'s 2-3 strengths — ${fmtList(scoreResult.topStrengths, lang, dims)} — write a 60-90 word paragraph explaining what the specific COMBINATION of these strengths together says about this person, not each one separately. Warm, non-clinical tone, no percentages in the body text. Consider their current relationship context: "${relationshipContextLabel} — ${relationshipContextText}".`
      : `A partir de estas 2-3 fortalezas de ${name} —${fmtList(scoreResult.topStrengths, lang, dims)}—, escribe un párrafo de 60-90 palabras que explique qué dice de esta persona la COMBINACIÓN específica de estas fortalezas juntas, no cada una por separado. Tono cálido, no clínico, sin porcentajes en el cuerpo del texto. Considera su contexto relacional actual: "${relationshipContextLabel} — ${relationshipContextText}".`;

  // 3. Síntesis de áreas de desarrollo combinadas
  const developmentPrompt =
    lang === "en"
      ? `Based on ${name}'s 2-3 development areas — ${fmtList(scoreResult.topDevelopmentAreas, lang, dims)} — write a 60-90 word paragraph connecting the shared pattern behind these areas, in a growth tone, never a flaw tone. Consider their current relationship context: "${relationshipContextLabel} — ${relationshipContextText}". No percentages in the body text.`
      : `A partir de estas 2-3 áreas de desarrollo de ${name} —${fmtList(scoreResult.topDevelopmentAreas, lang, dims)}—, escribe un párrafo de 60-90 palabras que conecte el patrón compartido detrás de estas áreas, en tono de crecimiento y nunca de defecto. Considera su contexto relacional actual: "${relationshipContextLabel} — ${relationshipContextText}". Sin porcentajes en el cuerpo del texto.`;

  // 4. Síntesis general (fortaleza + área de desarrollo principal)
  const overallPrompt =
    lang === "en"
      ? `Based on this user data — top strength: ${topStrengthLabel}, text: "${bandContentByCode[topStrength].text}"; top development area: ${topDevAreaLabel}, text: "${bandContentByCode[topDevArea].text}"; current relationship context: "${relationshipContextLabel} — ${relationshipContextText}" — write an 80-120 word paragraph in the second person that connects both realistically and compassionately, with no clinical language or outcome promises, closing with a concrete invitation to action.`
      : `A partir de estos datos del usuario —fortaleza principal: ${topStrengthLabel}, texto: "${bandContentByCode[topStrength].text}"; área de desarrollo principal: ${topDevAreaLabel}, texto: "${bandContentByCode[topDevArea].text}"; contexto relacional actual: "${relationshipContextLabel} — ${relationshipContextText}"— escribe un párrafo de 80-120 palabras en segunda persona que conecte ambas de forma realista y compasiva, sin lenguaje clínico ni promesas de resultado, cerrando con una invitación concreta a la acción.`;

  // 5. Narración del plan de acción a 90 días
  const recsText = scoreResult.topDevelopmentAreas
    .map((code) => `${dimensionLabel(code, lang)}: ${bandContentByCode[code].recommendations.join(" / ")}`)
    .join(" || ");
  const qualitativeText = (qualitativeAnswers || []).filter(Boolean).join(" || ") || (lang === "en" ? "(not answered)" : "(no respondidas)");
  const actionPlanPrompt =
    lang === "en"
      ? `Turn these already-written recommendations for ${name}'s priority development areas — ${recsText} — into a narrated 30/60/90-day action plan, in the second person, taking into account their current relationship context ("${relationshipContextLabel} — ${relationshipContextText}") and, where relevant, their qualitative-module answers (${qualitativeText}). Don't invent new recommendations: just organize and connect the existing ones into a concrete, actionable narrative of 150-200 words.`
      : `Convierte estas recomendaciones ya redactadas para las áreas de desarrollo prioritarias de ${name} —${recsText}— en un plan de acción narrado a 30/60/90 días, en segunda persona, que tome en cuenta su contexto relacional actual ("${relationshipContextLabel} — ${relationshipContextText}") y, si son relevantes, sus respuestas del módulo cualitativo (${qualitativeText}). No inventes recomendaciones nuevas: solo organiza y conecta las ya existentes en una narrativa concreta y accionable de 150-200 palabras.`;

  const [integralReading, strengthsSynthesis, developmentSynthesis, overallSynthesis, actionPlanNarrative] = await Promise.all([
    callClaude(system, integralPrompt, 400),
    callClaude(system, strengthsPrompt, 250),
    callClaude(system, developmentPrompt, 250),
    callClaude(system, overallPrompt, 300),
    callClaude(system, actionPlanPrompt, 450),
  ]);

  const fallback = (lang === "en"
    ? "[This section could not be generated right now. Your fixed dimension results below are complete and unaffected.]"
    : "[Esta sección no pudo generarse en este momento. Tus resultados fijos por dimensión, abajo, están completos y no se ven afectados.]");

  return {
    integralReading: integralReading || fallback,
    strengthsSynthesis: strengthsSynthesis || fallback,
    developmentSynthesis: developmentSynthesis || fallback,
    overallSynthesis: overallSynthesis || fallback,
    actionPlanNarrative: actionPlanNarrative || fallback,
    mockMode: MOCK_MODE,
  };
}

module.exports = { generateAISections, MOCK_MODE };
