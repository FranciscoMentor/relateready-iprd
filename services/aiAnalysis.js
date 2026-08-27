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

async function callClaude(systemPrompt, userPrompt, maxTokens = 500, mockText = null) {
  if (MOCK_MODE) {
    // Modo simulado (sin ANTHROPIC_API_KEY): en vez de mostrar una
    // descripción del prompt, devolvemos un párrafo de muestra ya redactado
    // y con tono correcto, para poder revisar el diseño/maquetado real del
    // informe. En producción (con la clave configurada) esto nunca se usa —
    // el texto real siempre lo redacta Claude a partir del prompt completo.
    return mockText || "[Texto de ejemplo — modo simulado. En producción, aquí aparece el párrafo real generado por Claude.]";
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
  "Eres un mentor cálido, cercano y no clínico especializado en preparación relacional para la marca RelateReady (Índice de Desarrollo y Fortalecimiento Relacional). " +
  "Nunca diagnosticas, nunca prometes resultados, nunca usas nombres de marca de terceros. " +
  "No repitas fórmulas genéricas: cada persona debe sentir que este texto fue escrito específicamente para ella.";
const SYSTEM_EN =
  "You are a warm, close, non-clinical mentor specialized in relationship readiness for the RelateReady (Relationship Development and Strengthening Index) brand. " +
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

  // 5. Narración del plan de acción a 3 semanas (semana 1 / semana 2 / semana 3)
  const recsText = scoreResult.topDevelopmentAreas
    .map((code) => `${dimensionLabel(code, lang)}: ${bandContentByCode[code].recommendations.join(" / ")}`)
    .join(" || ");
  const qualitativeText = (qualitativeAnswers || []).filter(Boolean).join(" || ") || (lang === "en" ? "(not answered)" : "(no respondidas)");
  const actionPlanPrompt =
    lang === "en"
      ? `Turn these already-written recommendations for ${name}'s priority development areas — ${recsText} — into a narrated, professional-toned 3-week action plan (Week 1 / Week 2 / Week 3), in the second person, taking into account their current relationship context ("${relationshipContextLabel} — ${relationshipContextText}") and, where relevant, their qualitative-module answers (${qualitativeText}). Give each week a short thematic focus and 2-3 concrete practices, building progressively from week to week. Don't invent new recommendations: only organize and connect the existing ones into a rich, concrete, actionable narrative of 260-320 words. Close with a warm paragraph inviting them to deepen this plan in a free 60-minute intake mentoring session with a relationship & personal development mentor — don't name a specific person, don't include a link or URL, just the invitation in prose, since the button appears right below in the report.`
      : `Convierte estas recomendaciones ya redactadas para las áreas de desarrollo prioritarias de ${name} —${recsText}— en un plan de acción narrado y de tono profesional a 3 semanas (Semana 1 / Semana 2 / Semana 3), en segunda persona, que tome en cuenta su contexto relacional actual ("${relationshipContextLabel} — ${relationshipContextText}") y, si son relevantes, sus respuestas del módulo cualitativo (${qualitativeText}). Dale a cada semana un foco temático breve y 2-3 prácticas concretas, construyendo progresivamente de una semana a la siguiente. No inventes recomendaciones nuevas: solo organiza y conecta las ya existentes en una narrativa rica, concreta y accionable de 260-320 palabras. Cierra con un párrafo cálido que invite a profundizar este plan en una sesión de mentoría indagatoria gratuita de 60 minutos con un mentor en relaciones y desarrollo personal — no menciones un nombre propio, no incluyas enlace ni URL, solo la invitación en prosa, ya que el botón aparece justo debajo en el informe.`;

  // Textos de muestra para modo simulado (sin ANTHROPIC_API_KEY) — solo para
  // poder revisar el maquetado real del informe antes de tener la clave de
  // Claude configurada. Usan los mismos datos ya resueltos (nombre,
  // fortaleza/área principal) para sonar razonablemente reales.
  const firstName = String(name || "").trim().split(/\s+/)[0] || name;
  const mock = {
    integralReading:
      lang === "en"
        ? `${firstName}, thank you for taking the time to look at yourself this closely — that alone says something about you. Reading through your answers, what stands out first is how naturally you show up in ${topStrengthLabel.split(" (")[0].toLowerCase()}: it's clearly a place you've already done real work, even if you've never named it that way. At the same time, there's a thread running through several of your answers around ${topDevAreaLabel.split(" (")[0].toLowerCase()} — not a flaw, more like an edge you haven't had reason to sharpen yet, especially given where you are right now: ${relationshipContextLabel}. None of this is a verdict on who you are in a relationship. It's closer to a conversation opener — the kind a mentor would have with you in the first ten minutes, before diving into anything technical. Keep reading; there's more here that's specifically about you, not a generic profile.`
        : `${firstName}, gracias por tomarte el tiempo de mirarte con esta honestidad — eso ya dice algo de ti. Al leer tus respuestas, lo primero que resalta es lo natural que te sale ${topStrengthLabel.split(" (")[0].toLowerCase()}: es evidente que ahí ya hiciste un trabajo real, aunque nunca lo hayas llamado así. Al mismo tiempo, hay un hilo que se repite en varias de tus respuestas alrededor de ${topDevAreaLabel.split(" (")[0].toLowerCase()} — no es un defecto, es más bien un filo que todavía no has tenido motivo de afilar, sobre todo considerando dónde estás ahora: ${relationshipContextLabel}. Nada de esto es un veredicto sobre cómo eres en pareja. Es más parecido a cómo empezaría contigo una primera conversación de acompañamiento, antes de entrar en cualquier tecnicismo. Sigue leyendo — hay más aquí que es específicamente tuyo, no un perfil genérico.`,
    strengthsSynthesis:
      lang === "en"
        ? `What's interesting isn't just that these strengths show up individually — it's how they reinforce each other. Together, they suggest someone who doesn't just avoid conflict or stay calm by accident, but who has built, over time, a genuine capacity to stay present with another person even when things get uncomfortable. That combination is rarer than it sounds, and it's a real foundation to build on.`
        : `Lo interesante no es solo que estas fortalezas aparezcan por separado, sino cómo se refuerzan entre sí. Juntas, sugieren a alguien que no evita el conflicto ni se mantiene en calma por casualidad, sino que ha construido, con el tiempo, una capacidad genuina de seguir presente con otra persona incluso cuando las cosas se ponen incómodas. Esa combinación es más rara de lo que suena, y es una base real sobre la cual construir.`,
    developmentSynthesis:
      lang === "en"
        ? `These areas aren't separate problems — they tend to show up together, usually in the same kind of moment: when something feels uncertain and there's no clear signal about where you stand with the other person. That's not a character flaw, it's a pattern that was probably useful once and just hasn't been updated. The good news is that patterns like this respond well to small, deliberate practice.`
        : `Estas áreas no son problemas separados — suelen aparecer juntas, generalmente en el mismo tipo de momento: cuando algo se siente incierto y no hay una señal clara sobre dónde estás parado con la otra persona. No es un defecto de carácter, es un patrón que probablemente fue útil alguna vez y simplemente no se ha actualizado. La buena noticia es que patrones así responden bien a práctica pequeña y deliberada.`,
    overallSynthesis:
      lang === "en"
        ? `You already lead with ${topStrengthLabel.split(" (")[0].toLowerCase()} more than you probably give yourself credit for, and that's exactly the resource you can lean on while you work on ${topDevAreaLabel.split(" (")[0].toLowerCase()}. The two aren't in tension — your strength is, in fact, the most direct path toward growth in the area that needs it. Given your current context (${relationshipContextLabel}), a good place to start isn't a big gesture, but one honest, low-stakes conversation this week where you practice naming what you actually feel instead of managing the moment. That single shift, repeated, is where real change tends to begin.`
        : `Ya lideras con ${topStrengthLabel.split(" (")[0].toLowerCase()} más de lo que probablemente te reconoces, y ese es exactamente el recurso en el que puedes apoyarte mientras trabajas en ${topDevAreaLabel.split(" (")[0].toLowerCase()}. Las dos cosas no están en tensión — tu fortaleza es, de hecho, el camino más directo hacia el crecimiento en el área que lo necesita. Dado tu contexto actual (${relationshipContextLabel}), un buen punto de partida no es un gesto grande, sino una conversación honesta y de bajo riesgo esta semana, donde practiques nombrar lo que realmente sientes en vez de manejar el momento. Ese solo cambio, repetido, es donde suele empezar el cambio real.`,
    actionPlanNarrative:
      lang === "en"
        ? `Week 1 is about noticing, not fixing. Before you try to change anything, spend the week simply naming — to yourself, in a journal or just in your head — the moments when the pattern shows up: a silence that feels heavier than it should, a small urge to pull back. Two or three times this week, pause for ten seconds before reacting and ask "what am I actually feeling right now?"\n\nWeek 2 moves from noticing to practicing, in low-stakes moments first. Pick one small, real thing to share with someone you trust — not a confession, just something true you'd normally keep to yourself. Alongside that, practice tolerating one moment of ambiguity without seeking immediate reassurance: if a message goes unanswered for a few hours, notice the urge to fill in the worst-case story, and let it pass without acting on it.\n\nWeek 3 is about consolidating under slightly more real conditions. Choose one conversation that actually matters — a boundary, a disagreement, something you've been avoiding — and have it using what you practiced: naming the feeling, staying present, resisting the pull to either overexplain or shut down. It won't be perfect, and it doesn't need to be. The goal isn't a flawless conversation; it's proof to yourself that you can stay in the room.\n\nThis plan is meant to be walked through with support, not alone. A free 60-minute intake mentoring session with a relationship & personal development mentor is included with your Extended Report — a space to talk through exactly where you are, ask what this plan doesn't answer, and get a second set of eyes on how it's going.`
        : `La Semana 1 es sobre notar, no corregir. Antes de intentar cambiar algo, dedica la semana simplemente a nombrar — para ti mismo/a, en un diario o solo mentalmente — los momentos en que aparece el patrón: un silencio que se siente más pesado de lo normal, un pequeño impulso de retraerte. Dos o tres veces esta semana, haz una pausa de diez segundos antes de reaccionar y pregúntate "¿qué estoy sintiendo realmente ahora mismo?"\n\nLa Semana 2 pasa de notar a practicar, primero en momentos de bajo riesgo. Elige algo pequeño y real para compartir con alguien de confianza — no una confesión, solo algo verdadero que normalmente te guardarías. Junto con eso, practica tolerar un momento de ambigüedad sin buscar tranquilidad inmediata: si un mensaje queda sin respuesta por unas horas, nota el impulso de imaginar el peor escenario, y déjalo pasar sin actuar sobre él.\n\nLa Semana 3 es sobre consolidar en condiciones un poco más reales. Elige una conversación que de verdad importe — un límite, un desacuerdo, algo que has estado evitando — y ténla usando lo que practicaste: nombrar lo que sientes, mantenerte presente, resistir el impulso de sobreexplicar o cerrarte. No va a ser perfecta, y no necesita serlo. La meta no es una conversación impecable; es la prueba, para ti mismo/a, de que puedes quedarte en la sala.\n\nEste plan está pensado para recorrerse con acompañamiento, no en soledad. Con tu Informe Extendido tienes incluida una sesión de mentoría indagatoria gratuita de 60 minutos con un mentor en relaciones y desarrollo personal — un espacio para conversar exactamente en dónde estás, preguntar lo que este plan no resuelve, y tener una segunda mirada sobre cómo va tu proceso.`,
  };

  const [integralReading, strengthsSynthesis, developmentSynthesis, overallSynthesis, actionPlanNarrative] = await Promise.all([
    callClaude(system, integralPrompt, 400, mock.integralReading),
    callClaude(system, strengthsPrompt, 250, mock.strengthsSynthesis),
    callClaude(system, developmentPrompt, 250, mock.developmentSynthesis),
    callClaude(system, overallPrompt, 300, mock.overallSynthesis),
    callClaude(system, actionPlanPrompt, 700, mock.actionPlanNarrative),
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
