// Banco de ítems del Índice de Desarrollo y Fortalecimiento Relacional — 40
// ítems núcleo (5 por dimensión × 8 dimensiones), 6 ítems de control de
// deseabilidad social, 3 preguntas cualitativas opcionales.
// Redacción 100% original.
//
// keying: "D" (directo, mayor acuerdo = mayor preparación) | "R" (inverso).

const CORE_ITEMS = {
  AS: [
    { keying: "D", es: "Cuando alguien se acerca emocionalmente a mí, me siento cómodo/a dejándolo pasar, sin necesidad de retirarme.", en: "When someone starts to get emotionally close to me, I feel comfortable letting it happen instead of pulling away." },
    { keying: "D", es: "Si una persona que me interesa se toma un tiempo para responder, mantengo la calma en vez de asumir lo peor.", en: "If someone I'm interested in takes a while to reply, I stay calm instead of assuming the worst." },
    { keying: "D", es: "Puedo depender de alguien y dejar que dependan de mí sin que eso me genere una sensación de amenaza.", en: "I can rely on someone and let them rely on me without it feeling threatening." },
    { keying: "R", es: "Necesito señales constantes de cariño para creer que la otra persona realmente quiere estar conmigo.", en: "I need constant signs of affection to believe the other person really wants to be with me." },
    { keying: "R", es: "Me cuesta relajarme en una relación nueva porque siento que en cualquier momento la otra persona se puede alejar.", en: "I find it hard to relax in a new relationship because I feel the other person could pull away at any moment." },
  ],
  DS: [
    { keying: "D", es: "Tomo mis decisiones importantes basándome en lo que yo pienso, aunque eso implique no coincidir con mi pareja.", en: "I make my important decisions based on what I think, even if that means disagreeing with my partner." },
    { keying: "D", es: "Puedo pasar tiempo separado/a de alguien que quiero sin que eso afecte mi estado de ánimo o mi sentido de identidad.", en: "I can spend time apart from someone I love without it affecting my mood or sense of identity." },
    { keying: "R", es: "Cuando alguien que me importa se molesta conmigo, tiendo a cambiar mi postura solo para que la tensión se calme.", en: "When someone I care about is upset with me, I tend to change my position just to ease the tension." },
    { keying: "R", es: "Se me hace difícil mantener mis propios planes o intereses cuando estoy en una relación.", en: "I find it hard to keep my own plans or interests once I'm in a relationship." },
    { keying: "R", es: "El estado de ánimo de la persona que me gusta termina definiendo el mío casi automáticamente.", en: "The mood of the person I like ends up shaping mine almost automatically." },
  ],
  RS: [
    { keying: "D", es: "Si alguien cancela un plan conmigo, primero pienso en explicaciones razonables antes que en que ya no le intereso.", en: "If someone cancels plans with me, I first think of reasonable explanations before assuming they've lost interest." },
    { keying: "D", es: "Puedo expresar lo que siento por alguien sin necesitar la certeza de que no seré rechazado/a.", en: "I can express how I feel about someone without needing certainty that I won't be rejected." },
    { keying: "R", es: "Interpreto casi cualquier distancia o silencio como una señal de que hice algo mal.", en: "I interpret almost any distance or silence as a sign that I did something wrong." },
    { keying: "R", es: "Evito decir lo que realmente siento por miedo a que la otra persona se aleje.", en: "I avoid saying what I really feel out of fear the other person will pull away." },
    { keying: "R", es: "Cuando percibo la más mínima señal de desinterés, mi primer impulso es alejarme yo primero.", en: "When I sense even the smallest sign of disinterest, my first impulse is to pull away first." },
  ],
  CG: [
    { keying: "D", es: "Creo que los desacuerdos en una relación son una oportunidad para conocer mejor al otro, no una señal de alarma.", en: "I believe disagreements in a relationship are a chance to know the other person better, not a red flag." },
    { keying: "D", es: "Estoy dispuesto/a a trabajar en una relación aunque al principio no todo fluya con facilidad.", en: "I'm willing to work on a relationship even if things don't flow easily at first." },
    { keying: "D", es: "Pienso que la compatibilidad de una pareja se construye con el tiempo, más que algo que simplemente se tiene o no se tiene desde el inicio.", en: "I think compatibility in a couple is built over time, rather than something you simply have or don't have from the start." },
    { keying: "R", es: "Si una relación requiere mucho esfuerzo desde el principio, para mí es señal de que esa persona no es la indicada.", en: "If a relationship requires a lot of effort from the start, to me that's a sign the person isn't the right one." },
    { keying: "R", es: "Cuando surge un primer conflicto serio, mi primer pensamiento suele ser que quizás esa relación no era para mí.", en: "When a first serious conflict comes up, my first thought is usually that maybe this relationship wasn't meant for me." },
  ],
  CR: [
    { keying: "D", es: "Cuando algo me molesta en una relación, suelo decir cómo me siento en vez de acumularlo o callarlo.", en: "When something bothers me in a relationship, I usually say how I feel instead of bottling it up." },
    { keying: "D", es: "Después de una discusión, normalmente soy capaz de dar el primer paso para reconciliarme.", en: "After an argument, I'm usually able to take the first step toward making up." },
    { keying: "D", es: "Puedo pedir disculpas cuando me equivoco sin sentir que eso me debilita frente a la otra persona.", en: "I can apologize when I'm wrong without feeling it weakens me in front of the other person." },
    { keying: "R", es: "Cuando estoy en desacuerdo con alguien que me importa, tiendo a criticar cómo es la otra persona en vez de hablar de lo que pasó.", en: "When I disagree with someone I care about, I tend to criticize who they are instead of talking about what happened." },
    { keying: "R", es: "Prefiero guardar silencio o alejarme antes que hablar directamente sobre lo que me molesta.", en: "I'd rather stay silent or walk away than talk directly about what's bothering me." },
  ],
  AR: [
    { keying: "D", es: "Mi sentido de valor personal no depende de tener pareja en este momento de mi vida.", en: "My sense of self-worth doesn't depend on having a partner right now." },
    { keying: "D", es: "Puedo poner un límite claro a alguien que me interesa sin sentir miedo de perderlo/a por eso.", en: "I can set a clear boundary with someone I'm interested in without fearing I'll lose them over it." },
    { keying: "D", es: "Me siento una persona valiosa incluso en los momentos en que una relación no está funcionando bien.", en: "I feel like a valuable person even at times when a relationship isn't going well." },
    { keying: "R", es: "Necesito la aprobación constante de la persona que me gusta para sentirme bien conmigo mismo/a.", en: "I need constant approval from the person I like to feel good about myself." },
    { keying: "R", es: "Me cuesta decir que no a alguien que me interesa, aunque lo que me pida no me parezca justo.", en: "I find it hard to say no to someone I'm interested in, even when what they ask doesn't feel fair." },
  ],
  IA: [
    { keying: "D", es: "Me resulta relativamente fácil compartir mis miedos o inseguridades con alguien que me interesa de verdad.", en: "I find it fairly easy to share my fears or insecurities with someone I'm genuinely interested in." },
    { keying: "D", es: "Estoy dispuesto/a a mostrar partes de mí que no son perfectas frente a alguien que quiero conocer mejor.", en: "I'm willing to show imperfect sides of myself to someone I want to get to know better." },
    { keying: "R", es: "Prefiero mantener una imagen controlada de mí mismo/a antes que mostrar mis vulnerabilidades a alguien nuevo.", en: "I'd rather keep a controlled image of myself than show my vulnerabilities to someone new." },
    { keying: "R", es: "Me cuesta hablar de temas emocionalmente profundos incluso con alguien que me interesa genuinamente.", en: "I find it hard to talk about emotionally deep topics even with someone I'm genuinely interested in." },
    { keying: "R", es: "Cuando alguien intenta conocerme más a fondo, tiendo a cambiar de tema o a quitarle importancia.", en: "When someone tries to get to know me more deeply, I tend to change the subject or brush it off." },
  ],
  CV: [
    { keying: "D", es: "Tengo claro qué papel quiero que ocupe una relación de pareja en mi vida en los próximos años.", en: "I have a clear sense of what role I want a romantic relationship to play in my life over the next few years." },
    { keying: "D", es: "Sé con bastante claridad qué es no negociable para mí en una relación y qué sí estoy dispuesto/a a negociar.", en: "I know fairly clearly what's non-negotiable for me in a relationship and what I am willing to negotiate." },
    { keying: "R", es: "No tengo muy claro qué espero realmente de una relación en esta etapa de mi vida.", en: "I'm not very clear on what I actually expect from a relationship at this stage of my life." },
    { keying: "R", es: "Suelo dejar que sea la otra persona quien defina hacia dónde va la relación, más que yo.", en: "I tend to let the other person define where the relationship is going, rather than me." },
    { keying: "R", es: "Me cuesta identificar qué es lo que realmente busco en una pareja, más allá de la atracción inicial.", en: "I find it hard to identify what I'm really looking for in a partner, beyond initial attraction." },
  ],
};

const DESIRABILITY_ITEMS = [
  { es: "Nunca he sentido envidia de la relación de otra pareja.", en: "I have never felt envious of another couple's relationship." },
  { es: "Jamás he dicho una mentira, ni siquiera pequeña, para evitar un conflicto de pareja.", en: "I have never told a lie, not even a small one, to avoid a conflict with a partner." },
  { es: "Siempre escucho con total paciencia, sin importar cuán cansado/a o de mal humor esté.", en: "I always listen with complete patience, no matter how tired or irritable I am." },
  { es: "Nunca he tenido un pensamiento negativo sobre alguien que quiero.", en: "I have never had a negative thought about someone I love." },
  { es: "Jamás he actuado de forma egoísta en una relación cercana.", en: "I have never acted selfishly in a close relationship." },
  { es: "Siempre mantengo la calma perfecta, incluso en discusiones muy tensas.", en: "I always stay perfectly calm, even during very tense arguments." },
];

const QUALITATIVE_ITEMS = [
  { es: "Describe brevemente un patrón que notas que se repite en tus relaciones pasadas y que te gustaría cambiar.", en: "Briefly describe a pattern you notice repeating in your past relationships that you'd like to change." },
  { es: "¿Qué es lo que más te cuesta sostener en una relación: la cercanía, la independencia, la comunicación durante un conflicto, o algo distinto? Explica brevemente.", en: "What do you find hardest to sustain in a relationship: closeness, independence, communication during conflict, or something else? Briefly explain." },
  { es: "Si pudieras pedirle una sola cosa a tu yo del pasado antes de tu última relación, ¿cuál sería?", en: "If you could ask one thing of your past self before your last relationship, what would it be?" },
];

// ── Adaptación por situación relacional (2026-10) ───────────────────────────
// Los ítems núcleo se puntúan por id y por "keying" (scoring.js), así que
// cambiar SOLO la redacción para quien ya está en pareja o viene de una
// separación no altera el cálculo: el id, la dimensión y el sentido (D/R)
// son los mismos. Grupos (ver contextGroup en relationshipContexts.js):
//   buscando       → texto original (soltero/a, primeras citas, etc.)
//   en_pareja      → referencias a "mi pareja" en vez de "alguien que me interesa"
//   reconstruyendo / abierto → texto original salvo donde nombra "mi pareja"
// Solo se listan los ítems cuya redacción original NO encaja con el grupo.
const CORE_VARIANTS = {
  en_pareja: {
    AS02: { es: "Si mi pareja se toma un tiempo para responder, mantengo la calma en vez de asumir lo peor.", en: "If my partner takes a while to reply, I stay calm instead of assuming the worst." },
    AS05: { es: "Me cuesta relajarme en mi relación porque siento que en cualquier momento la otra persona se puede alejar.", en: "I find it hard to relax in my relationship because I feel the other person could pull away at any moment." },
    DS05: { es: "El estado de ánimo de mi pareja termina definiendo el mío casi automáticamente.", en: "My partner's mood ends up shaping mine almost automatically." },
    CG02: { es: "Estoy dispuesto/a a trabajar en una relación aunque no todo fluya con facilidad.", en: "I'm willing to work on a relationship even if things don't flow easily." },
    CG04: { es: "Si una relación requiere mucho esfuerzo, para mí es señal de que esa persona no es la indicada.", en: "If a relationship requires a lot of effort, to me that's a sign the person isn't the right one." },
    CG05: { es: "Cuando surge un conflicto serio, mi primer pensamiento suele ser que quizás esa relación no era para mí.", en: "When a serious conflict comes up, my first thought is usually that maybe this relationship wasn't meant for me." },
    AR01: { es: "Mi sentido de valor personal no depende de mi relación de pareja ni de cómo vaya en este momento.", en: "My sense of self-worth doesn't depend on my relationship or on how it's going right now." },
    AR02: { es: "Puedo poner un límite claro a mi pareja sin sentir miedo de perderla por eso.", en: "I can set a clear boundary with my partner without fearing I'll lose them over it." },
    AR04: { es: "Necesito la aprobación constante de mi pareja para sentirme bien conmigo mismo/a.", en: "I need my partner's constant approval to feel good about myself." },
    AR05: { es: "Me cuesta decir que no a mi pareja, aunque lo que me pida no me parezca justo.", en: "I find it hard to say no to my partner, even when what they ask doesn't feel fair." },
    IA01: { es: "Me resulta relativamente fácil compartir mis miedos o inseguridades con mi pareja.", en: "I find it fairly easy to share my fears or insecurities with my partner." },
    IA02: { es: "Estoy dispuesto/a a mostrar partes de mí que no son perfectas frente a mi pareja.", en: "I'm willing to show imperfect sides of myself to my partner." },
    IA03: { es: "Prefiero mantener una imagen controlada de mí mismo/a antes que mostrar mis vulnerabilidades, incluso ante mi pareja.", en: "I'd rather keep a controlled image of myself than show my vulnerabilities, even to my partner." },
    IA04: { es: "Me cuesta hablar de temas emocionalmente profundos incluso con mi pareja.", en: "I find it hard to talk about emotionally deep topics even with my partner." },
    CV05: { es: "Me cuesta identificar qué es lo que realmente quiero de mi relación de pareja, más allá de la costumbre.", en: "I find it hard to identify what I really want from my relationship, beyond habit." },
  },
  neutral: {
    DS01: { es: "Tomo mis decisiones importantes basándome en lo que yo pienso, aunque eso implique no coincidir con las personas cercanas a mí.", en: "I make my important decisions based on what I think, even if that means disagreeing with the people close to me." },
  },
};

function variantGroup(group) {
  if (group === "en_pareja") return "en_pareja";
  if (group === "reconstruyendo" || group === "abierto") return "neutral";
  return null; // "buscando" o sin dato → texto original
}

// Ítems núcleo con la redacción adaptada al grupo relacional (mismos ids).
function coreItemsForGroup(flatItems, group) {
  const v = CORE_VARIANTS[variantGroup(group)];
  if (!v) return flatItems;
  return flatItems.map((i) => (v[i.id] ? { ...i, es: v[i.id].es, en: v[i.id].en } : i));
}

// Preguntas cualitativas (opcionales, sin puntuar) por grupo. Alimentan solo
// el texto que redacta la IA. "buscando" conserva las 3 originales.
const QUALITATIVE_VARIANTS = {
  en_pareja: [
    { es: "Describe brevemente un patrón que notas que se repite en tu relación actual (o en relaciones anteriores) y que te gustaría cambiar.", en: "Briefly describe a pattern you notice repeating in your current relationship (or in past ones) that you'd like to change." },
    QUALITATIVE_ITEMS[1],
    { es: "Si pudieras decirle una sola cosa a tu pareja sin miedo a cómo la tome, ¿cuál sería?", en: "If you could tell your partner one thing without fearing how they'd take it, what would it be?" },
  ],
  reconstruyendo: [
    { es: "Describe brevemente algo que has aprendido sobre ti en tus relaciones pasadas y que quieres llevar contigo —o hacer distinto— en esta nueva etapa.", en: "Briefly describe something you've learned about yourself in your past relationships that you want to carry with you — or do differently — in this new chapter." },
    QUALITATIVE_ITEMS[1],
    { es: "Si pudieras darte un consejo al comenzar esta nueva etapa de tu vida, ¿cuál sería?", en: "If you could give yourself one piece of advice as you begin this new chapter of your life, what would it be?" },
  ],
  abierto: [
    { es: "Describe brevemente un patrón que notas que se repite en tus relaciones cercanas y que te gustaría cambiar.", en: "Briefly describe a pattern you notice repeating in your close relationships that you'd like to change." },
    QUALITATIVE_ITEMS[1],
    { es: "Si pudieras darte un consejo sobre cómo vivir tus relaciones de aquí en adelante, ¿cuál sería?", en: "If you could give yourself one piece of advice on how to live your relationships from here on, what would it be?" },
  ],
};

function qualitativeItemsForGroup(group) {
  const list = QUALITATIVE_VARIANTS[group] || QUALITATIVE_ITEMS;
  return list.map((item, idx) => ({ id: `QM${String(idx + 1).padStart(2, "0")}`, ...item }));
}

// Construye la lista plana de ítems núcleo con id (AS01..AS06, DS01..DS06, ...)
// en el orden de dimensiones definido en dimensions.js, ya intercalable con
// los ítems de deseabilidad en el frontend.
const { DIMENSION_CODES } = require("./dimensions");

function buildFlatCoreItems() {
  const flat = [];
  for (const code of DIMENSION_CODES) {
    CORE_ITEMS[code].forEach((item, idx) => {
      flat.push({ id: `${code}${String(idx + 1).padStart(2, "0")}`, dimension: code, ...item });
    });
  }
  return flat;
}

function buildFlatDesirabilityItems() {
  return DESIRABILITY_ITEMS.map((item, idx) => ({ id: `DES${String(idx + 1).padStart(2, "0")}`, ...item }));
}

function buildFlatQualitativeItems() {
  return QUALITATIVE_ITEMS.map((item, idx) => ({ id: `QM${String(idx + 1).padStart(2, "0")}`, ...item }));
}

module.exports = {
  CORE_ITEMS,
  DESIRABILITY_ITEMS,
  QUALITATIVE_ITEMS,
  buildFlatCoreItems,
  coreItemsForGroup,
  qualitativeItemsForGroup,
  buildFlatDesirabilityItems,
  buildFlatQualitativeItems,
};
