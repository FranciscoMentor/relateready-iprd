// 3 viñetas de apertura — NO puntuadas. Ver IPRD_especificacion_tecnica.docx,
// sección 4bis. Uso exclusivamente narrativo/UX; cada opción sugiere
// informalmente un patrón para el tono del informe, nunca para el cálculo.
const VIGNETTES = [
  {
    id: "VIG01",
    dimensionHint: "CR/AS",
    escenario: {
      es: "Tu pareja llega tarde a una cita importante sin avisar. Cuando por fin llega, no da mayor explicación.",
      en: "Your partner arrives late to an important date without letting you know. When they finally arrive, they don't offer much of an explanation.",
    },
    pregunta: {
      es: "¿Cuál de estas reacciones se parece más a lo que probablemente sentirías o harías?",
      en: "Which of these reactions feels closest to what you'd probably feel or do?",
    },
    opciones: [
      { key: "a", pattern: "seguro", es: "Le preguntaría qué pasó, con curiosidad genuina, antes de sacar conclusiones.", en: "I'd ask what happened, out of genuine curiosity, before jumping to conclusions." },
      { key: "b", pattern: "ansioso", es: "Sentiría que se confirma que no puedo confiar en que me tomen en cuenta.", en: "I'd feel like it confirms I can't count on being taken into account." },
      { key: "c", pattern: "evitativo", es: "Dejaría pasar el tema para evitar un conflicto, aunque me haya molestado.", en: "I'd let it go to avoid a conflict, even though it bothered me." },
      { key: "d", pattern: "baja_regulacion", es: "Reaccionaría con enojo inmediato y se lo haría notar sin filtro.", en: "I'd react with immediate anger and let them know, unfiltered." },
    ],
  },
  {
    id: "VIG02",
    dimensionHint: "DS/AR",
    escenario: {
      es: "Llevas una semana intensa de trabajo. Tu pareja te propone pasar el fin de semana completo juntos, sin planes de por medio.",
      en: "You've had an intense week of work. Your partner suggests spending the entire weekend together, with no plans at all.",
    },
    pregunta: {
      es: "¿Qué es lo que más resuena contigo?",
      en: "What resonates most with you?",
    },
    opciones: [
      { key: "a", pattern: "seguro", es: "Lo recibiría con alivio; estar juntos es justo lo que necesito para recargar.", en: "I'd feel relieved; being together is exactly what I need to recharge." },
      { key: "b", pattern: "evitativo_leve", es: "Sentiría algo de presión, aunque no sepa bien cómo decirlo.", en: "I'd feel some pressure, even if I'm not sure how to put it into words." },
      { key: "c", pattern: "diferenciacion_en_desarrollo", es: "Preferiría negociar un punto medio, aunque me cueste plantearlo.", en: "I'd rather negotiate a middle ground, even if it's hard for me to bring up." },
      { key: "d", pattern: "baja_diferenciacion", es: "Aceptaría, pero por dentro sentiría que pierdo mi espacio propio.", en: "I'd agree, but inside I'd feel like I'm losing my own space." },
    ],
  },
  {
    id: "VIG03",
    dimensionHint: "IA",
    escenario: {
      es: "Algo te afectó profundamente durante el día, pero tu pareja no lo ha notado.",
      en: "Something affected you deeply during the day, but your partner hasn't noticed.",
    },
    pregunta: {
      es: "¿Qué es más probable que hagas?",
      en: "What are you most likely to do?",
    },
    opciones: [
      { key: "a", pattern: "alta_intimidad", es: "Se lo contaría abiertamente, esperando que me acompañe.", en: "I'd tell them openly, hoping they'd be there for me." },
      { key: "b", pattern: "ansioso_pasivo", es: "Esperaría a que lo note por sí misma antes de decir algo.", en: "I'd wait for them to notice on their own before saying anything." },
      { key: "c", pattern: "baja_apertura", es: "Minimizaría lo que sentí, incluso ante mí mismo/a.", en: "I'd downplay what I felt, even to myself." },
      { key: "d", pattern: "evitativo", es: "Buscaría resolverlo solo/a antes de mencionarlo, si es que llego a mencionarlo.", en: "I'd try to work through it on my own before mentioning it, if I mention it at all." },
    ],
  },
];

module.exports = { VIGNETTES };
