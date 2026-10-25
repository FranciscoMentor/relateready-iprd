// services/sessionCopy.js
//
// Textos de la invitación a la sesión de mentoring gratuita para revisar el
// informe: los usan el PDF (services/pdfGenerator.js) y el correo del informe
// (services/emailTemplates.js). La pantalla de resultados tiene su propia copia
// en public/js/app.js (mismo contenido; si cambias uno, cambia el otro).
//
// Nombre único en todos lados: "sesión de mentoring para revisar tu informe" /
// "mentoring session to review your report". El mentor se menciona de forma
// genérica (sin nombre propio), como en el resto del informe.
//
// El plazo (until / expired) sale de services/sessionDeadline.js; aquí solo se
// convierte en frase. Sin plazo no se dice nada de fechas.

const { humanDate } = require("./dateText");

const MENTOR = {
  es: "un mentor profesional que tiene años de experiencia en desarrollo personal aplicado a las relaciones y a tu capacidad de relacionarte",
  en: "a professional mentor who has years of experience in personal development applied to relationships and to your capacity to relate",
};

const COPY = {
  es: {
    title: "Tu sesión de mentoring para revisar tu informe",
    btn: "Agendar mi sesión de mentoring",
    intro: `Tus resultados son un mapa, y un mapa se lee mejor con alguien que conoce el terreno. Tu Informe Extendido incluye una sesión de mentoring gratuita de 60 minutos con ${MENTOR.es}. Juntos revisan este informe para que no tengas que interpretarlo por tu cuenta, y sales con:`,
    bullets: [
      ["Una lectura clara de tus resultados: ", "qué significa cada pilar para ti y qué no significa."],
      ["Tus prioridades: ", "cuál o cuáles de tus 8 pilares atender primero, según tu situación real."],
      ["Tu plan de 3 semanas ajustado a tu vida, ", "no una lista genérica."],
      ["Respuestas a tus preguntas, ", "incluidas las que el informe no puede responder."],
      ["\"Tú Primero\": ", "el libro digital gratuito que solo se entrega en esta sesión."],
    ],
    closing: "Es una conversación de mentoring, no un examen ni una llamada de ventas. Solo trae tu informe.",
    shortIntro: `Cuando termines de leerlo, tu siguiente paso es revisarlo con ${MENTOR.es} en tu sesión de mentoring gratuita de 60 minutos. Los números de un informe se malinterpretan con facilidad: en la sesión entenderás qué significan para ti y por dónde empezar.`,
    deadline: (d) => `Agenda tu sesión gratuita hasta el ${d}.`,
    expired: (d) => `El plazo para agendar tu sesión gratuita terminó el ${d}. Responde al correo con el que recibiste este informe y vemos tus opciones.`,
    emailSubject: "Tu informe está listo, y tu sesión de mentoring gratuita te espera",
    emailSubjectExpired: "Tu informe de RelateReady está listo",
  },
  en: {
    title: "Your mentoring session to review your report",
    btn: "Book my mentoring session",
    intro: `Your results are a map, and a map is easier to read with someone who knows the terrain. Your Extended Report includes a free 60-minute mentoring session with ${MENTOR.en}. Together you go through this report so you don't have to interpret it on your own, and you leave with:`,
    bullets: [
      ["A clear reading of your results: ", "what each pillar means for you, and what it doesn't."],
      ["Your priorities: ", "which one or two of your 8 pillars to work on first, given your real situation."],
      ["Your 3-week plan, adjusted to your life, ", "not a generic list."],
      ["Answers to your questions, ", "including the ones the report can't answer."],
      ["\"You First\": ", "the free digital book we only share in this session."],
    ],
    closing: "It's a mentoring conversation, not an exam or a sales call. Just bring your report.",
    shortIntro: `When you finish reading, your next step is to review it with ${MENTOR.en} in your free 60-minute mentoring session. Scores in a report are easy to misread: in the session you'll work out what they mean for you and where to start.`,
    deadline: (d) => `Book your free session by ${d}.`,
    expired: (d) => `The deadline to book your free session ended on ${d}. Reply to the email that came with this report and we'll look at your options.`,
    emailSubject: "Your report is ready, and your free mentoring session is waiting",
    emailSubjectExpired: "Your RelateReady report is ready",
  },
};

function copyFor(lang) {
  return COPY[lang === "en" ? "en" : "es"];
}

/** Frase del plazo según la persona: "" si no tiene plazo. session = { until, expired } */
function deadlineLine(lang, session) {
  const c = copyFor(lang);
  const d = session && session.until ? humanDate(session.until, lang === "en" ? "en" : "es") : null;
  if (!d) return "";
  return session.expired ? c.expired(d) : c.deadline(d);
}

module.exports = { copyFor, deadlineLine };
