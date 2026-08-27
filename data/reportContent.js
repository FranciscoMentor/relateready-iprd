// Texto interpretativo fijo por dimensión × banda — EL INSTRUMENTO VALIDADO.
// Fuente: IPRD_puntuacion_e_interpretacion.docx (Fase C). Este contenido NUNCA
// se reescribe ni se parafrasea por IA — debe insertarse igual para cualquier
// persona con ese resultado (ver IPRD_especificacion_tecnica.docx, sección 5bis).
//
// gv(m, f, n): texto que varía según el género de intake (Masculino/Femenino/
// Neutro). Donde no hay variación de género, el valor es un string plano.
function gv(m, f, n) {
  return { m, f, n };
}
function isGV(x) {
  return x && typeof x === "object" && "m" in x;
}
// Resuelve un bloque (string o gv()) al texto correspondiente al género de intake.
// gender: "M" | "F" | "N" (N = Prefiero no especificar / neutro).
function resolveGender(block, gender) {
  if (!isGV(block)) return block;
  if (gender === "M") return block.m;
  if (gender === "F") return block.f;
  return block.n;
}

const CONTENT = {
  AS: {
    es: {
      f: "Te resulta natural confiar en la estabilidad de un lazo afectivo sin necesitar pruebas constantes. Puedes acercarte y dejar que se acerquen a ti sin que la cercanía se sienta amenazante. Esta es una de tus bases más sólidas para sostener una relación en el tiempo: sigue cuidándola compartiendo abiertamente lo que sientes, incluso cuando todo va bien.",
      m: "En general puedes manejar la incertidumbre normal de una relación, aunque en momentos de mayor estrés o distancia es posible que aparezcan dudas sobre si la otra persona sigue ahí. Practicar nombrar esas dudas en voz alta —en vez de solo interpretarlas en silencio— puede ayudarte a fortalecer esta base.",
      d: gv(
        "Es probable que necesites señales frecuentes de cariño para sentirte seguro en una relación, y que los silencios o las esperas se vivan como amenaza. Esto no es un defecto de carácter: es un patrón aprendido, y se puede entrenar.",
        "Es probable que necesites señales frecuentes de cariño para sentirte segura en una relación, y que los silencios o las esperas se vivan como amenaza. Esto no es un defecto de carácter: es un patrón aprendido, y se puede entrenar.",
        "Es probable que necesites señales frecuentes de cariño para sentir seguridad dentro de una relación, y que los silencios o las esperas se vivan como amenaza. Esto no es un defecto de carácter: es un patrón aprendido, y se puede entrenar."
      ),
      rec: [
        "Antes de interpretar una ausencia de respuesta como rechazo, anota otras explicaciones posibles.",
        "Practica tolerar pequeños momentos de incertidumbre sin buscar confirmación inmediata.",
        "Si la ansiedad es intensa y constante, considera acompañamiento profesional para trabajar el origen de este patrón.",
      ],
    },
    en: {
      f: "Trusting the stability of a bond comes naturally to you, without needing constant proof. You can get close to someone — and let them get close to you — without closeness feeling threatening. This is one of your strongest foundations for sustaining a relationship over time: keep nurturing it by sharing openly even when things are going well.",
      m: "You can generally handle the normal uncertainty of a relationship, though in moments of stress or distance, doubts about whether the other person is still there may surface. Practicing naming those doubts out loud — instead of just interpreting them in silence — can help strengthen this foundation.",
      d: "You likely need frequent signs of affection to feel secure in a relationship, and silences or waiting periods may feel threatening. This isn't a character flaw — it's a learned pattern, and it can be trained.",
      rec: [
        "Before interpreting a lack of response as rejection, write down other possible explanations.",
        "Practice tolerating small moments of uncertainty without seeking immediate reassurance.",
        "If the anxiety is intense and constant, consider professional support to work on where this pattern comes from.",
      ],
    },
  },
  DS: {
    es: {
      f: gv(
        "Sabes sostener quién eres incluso muy cerca de alguien más: tus opiniones, tus planes y tu estado de ánimo no dependen de fundirte con la otra persona. Esto te permite construir intimidad real sin perderte a ti mismo. Sigue protegiendo espacios propios (intereses, amistades, tiempo a solas) aunque la relación avance.",
        "Sabes sostener quién eres incluso muy cerca de alguien más: tus opiniones, tus planes y tu estado de ánimo no dependen de fundirte con la otra persona. Esto te permite construir intimidad real sin perderte a ti misma. Sigue protegiendo espacios propios (intereses, amistades, tiempo a solas) aunque la relación avance.",
        "Sabes sostener quién eres incluso muy cerca de alguien más: tus opiniones, tus planes y tu estado de ánimo no dependen de fundirte con la otra persona. Esto te permite construir intimidad real sin perder tu propia identidad. Sigue protegiendo espacios propios (intereses, amistades, tiempo a solas) aunque la relación avance."
      ),
      m: "Puedes mantener tu identidad en la mayoría de las situaciones, aunque frente a un desacuerdo importante es posible que cedas más de lo que realmente quieres solo para bajar la tensión. Practicar sostener una postura propia en desacuerdos pequeños es un buen entrenamiento para los grandes.",
      d: "Es probable que tu estado de ánimo y tus decisiones se vean fuertemente arrastrados por los de la persona que te interesa, y que cambiar de opinión para evitar tensión sea tu respuesta automática.",
      rec: [
        "Antes de una conversación difícil, define por escrito qué es lo que tú realmente piensas o necesitas.",
        "Practica expresar un desacuerdo pequeño y observa que la relación puede sostenerlo.",
        "Identifica un espacio o actividad propia que no dependas de compartir con nadie más, y protégelo.",
      ],
    },
    en: {
      f: "You know how to hold onto who you are even when you're very close to someone else: your opinions, plans, and mood don't depend on merging with the other person. This lets you build real intimacy without losing yourself. Keep protecting spaces that are yours alone — interests, friendships, solo time — even as the relationship deepens.",
      m: "You can hold onto your identity in most situations, though during a significant disagreement you may give in more than you actually want to, just to lower the tension. Practicing holding your ground on small disagreements is good training for the bigger ones.",
      d: "Your mood and decisions are likely pulled strongly by those of the person you're interested in, and changing your mind to avoid tension may be your automatic response.",
      rec: [
        "Before a difficult conversation, write down what you actually think or need.",
        "Practice voicing a small disagreement and notice that the relationship can hold it.",
        "Identify a space or activity that's entirely your own, and protect it.",
      ],
    },
  },
  RS: {
    es: {
      f: "Puedes tolerar señales ambiguas —un mensaje corto, un plan cancelado— sin saltar de inmediato a la conclusión de que algo anda mal. Esto te permite acercarte a otras personas sin la guardia constantemente en alto. Sigue dándote el tiempo de verificar antes de reaccionar.",
      m: "La mayoría de las veces manejas bien la ambigüedad, pero en momentos de mayor vulnerabilidad (como el inicio de una conexión nueva) es posible que interpretes distancia donde solo hay ocupación o cansancio del otro. Nombrar esa lectura en voz alta, en vez de actuar directamente sobre ella, ayuda a calibrarla.",
      d: "Es probable que interpretes con frecuencia el silencio o la distancia como rechazo, y que eso te lleve a alejarte primero o a evitar decir lo que sientes por miedo a la respuesta.",
      rec: [
        "Cuando aparezca la interpretación de rechazo, busca activamente al menos dos explicaciones alternativas antes de actuar.",
        "Practica expresar un interés o una molestia pequeña, en vez de callarla, y observa el resultado real.",
        "Si el patrón es intenso, trabajarlo con acompañamiento profesional puede acelerar el cambio.",
      ],
    },
    en: {
      f: "You can tolerate ambiguous signals — a short text, a cancelled plan — without immediately jumping to the conclusion that something's wrong. This lets you approach other people without your guard constantly up. Keep giving yourself time to check before reacting.",
      m: "Most of the time you handle ambiguity well, but in more vulnerable moments (like the start of a relationship) you may read distance into what's really just the other person being busy or tired. Naming that reading out loud, instead of acting on it directly, helps calibrate it.",
      d: "You likely interpret silence or distance as rejection fairly often, and that may lead you to pull away first or avoid saying how you feel out of fear of the response.",
      rec: [
        "When the rejection interpretation shows up, actively look for at least two alternative explanations before acting.",
        "Practice voicing a small interest or annoyance instead of holding it in, and notice the actual outcome.",
        "If the pattern is intense, working on it with professional support can speed up the change.",
      ],
    },
  },
  CG: {
    es: {
      f: "Ves el conflicto como parte normal de conocer a alguien, no como una señal de que algo está roto. Esto te da paciencia para atravesar las etapas difíciles de una relación en vez de abandonarla a la primera señal de fricción. Sigue recordando esta creencia especialmente en los primeros meses de un vínculo nuevo.",
      m: gv(
        "En general estás dispuesto a trabajar en una relación, aunque un conflicto fuerte al inicio puede hacerte dudar de si vale la pena continuar. Diferenciar entre “esto requiere trabajo” y “esto no es para mí” es la habilidad a seguir entrenando.",
        "En general estás dispuesta a trabajar en una relación, aunque un conflicto fuerte al inicio puede hacerte dudar de si vale la pena continuar. Diferenciar entre “esto requiere trabajo” y “esto no es para mí” es la habilidad a seguir entrenando.",
        "En general muestras disposición a trabajar en una relación, aunque un conflicto fuerte al inicio puede hacerte dudar de si vale la pena continuar. Diferenciar entre “esto requiere trabajo” y “esto no es para mí” es la habilidad a seguir entrenando."
      ),
      d: "Es probable que interpretes la dificultad temprana en una relación como prueba de incompatibilidad, más que como parte normal del proceso de conocerse.",
      rec: [
        "Antes de decidir terminar tras un conflicto, date un tiempo mínimo de reflexión antes de actuar.",
        "Pregúntate si la dificultad es sobre la persona o sobre el patrón que tiendes a repetir.",
        "Recuerda que ninguna relación fluye perfecto desde el inicio: la pregunta útil no es “¿esto es fácil?” sino “¿esto vale la pena trabajarlo?”.",
      ],
    },
    en: {
      f: "You see conflict as a normal part of getting to know someone, not as a sign that something is broken. This gives you the patience to get through a relationship's hard stretches instead of abandoning it at the first sign of friction. Keep holding onto this belief especially in the early months of a new relationship.",
      m: "You're generally willing to work on a relationship, though a strong early conflict can make you question whether it's worth continuing. Telling apart “this needs work” from “this isn't for me” is the skill worth continuing to train.",
      d: "You likely read early difficulty in a relationship as proof of incompatibility, rather than as a normal part of getting to know someone.",
      rec: [
        "Before deciding to end things after a conflict, give yourself a minimum reflection period before acting.",
        "Ask yourself whether the difficulty is about the person or about a pattern you tend to repeat.",
        "Remember that no relationship flows perfectly from the start: the useful question isn't “is this easy?” but “is this worth working on?”.",
      ],
    },
  },
  CR: {
    es: {
      f: "Dices lo que te molesta en vez de acumularlo, y eres capaz de dar el primer paso para reconciliarte después de una discusión. Esta es una de las habilidades más determinantes para sostener una relación en el tiempo — sigue practicándola incluso en conflictos pequeños.",
      m: "Puedes comunicar lo que sientes en la mayoría de los casos, aunque en discusiones más intensas es posible que te cueste ser quien da el primer paso de reconciliación. Practicar frases cortas de apertura (“quiero que hablemos de esto”) puede facilitarte ese primer paso.",
      d: "Es probable que evites decir lo que te molesta hasta que se acumula, o que en un desacuerdo termines criticando a la persona en vez de hablar de lo que pasó.",
      rec: [
        "Practica la estructura “cuando pasó X, sentí Y” en vez de “tú siempre haces X”.",
        "Identifica tu primera señal física de que algo te está molestando, para decirlo antes de que se acumule.",
        "Después de una discusión, proponte dar el primer paso de reconciliación aunque no sientas que “te toca”.",
      ],
    },
    en: {
      f: "You say what's bothering you instead of bottling it up, and you're able to take the first step toward making up after an argument. This is one of the most decisive skills for sustaining a relationship over time — keep practicing it even in small conflicts.",
      m: "You can communicate how you feel in most cases, though in more intense arguments you may find it hard to be the one who takes the first step toward reconciliation. Practicing short opening lines (“I want us to talk about this”) can make that first step easier.",
      d: "You likely avoid saying what bothers you until it piles up, or end up criticizing the person instead of talking about what happened during a disagreement.",
      rec: [
        "Practice the structure “when X happened, I felt Y” instead of “you always do X”.",
        "Identify your earliest physical sign that something is bothering you, so you can say it before it builds up.",
        "After an argument, make a point of taking the first step toward reconciliation even if it doesn't feel like “your turn”.",
      ],
    },
  },
  AR: {
    es: {
      f: gv(
        "Tu sentido de valor no depende de tener pareja ni de la aprobación constante de la persona que te interesa. Puedes poner límites sin miedo a perder la conexión. Esta base te protege de sostener relaciones por miedo a estar solo — sigue reforzándola con actividades y relaciones que te recuerden tu valor fuera de la pareja.",
        "Tu sentido de valor no depende de tener pareja ni de la aprobación constante de la persona que te interesa. Puedes poner límites sin miedo a perder la conexión. Esta base te protege de sostener relaciones por miedo a estar sola — sigue reforzándola con actividades y relaciones que te recuerden tu valor fuera de la pareja.",
        "Tu sentido de valor no depende de tener pareja ni de la aprobación constante de la persona que te interesa. Puedes poner límites sin miedo a perder la conexión. Esta base te protege de sostener relaciones por miedo a la soledad — sigue reforzándola con actividades y relaciones que te recuerden tu valor fuera de la pareja."
      ),
      m: gv(
        "En general te sientes valioso independientemente de cómo va una relación, aunque decir que no a algo que te incomoda puede costarte más de lo que te gustaría. Practicar límites pequeños en contextos de bajo riesgo fortalece esta base.",
        "En general te sientes valiosa independientemente de cómo va una relación, aunque decir que no a algo que te incomoda puede costarte más de lo que te gustaría. Practicar límites pequeños en contextos de bajo riesgo fortalece esta base.",
        "En general reconoces tu propio valor independientemente de cómo va una relación, aunque decir que no a algo que te incomoda puede costarte más de lo que te gustaría. Practicar límites pequeños en contextos de bajo riesgo fortalece esta base."
      ),
      d: gv(
        "Es probable que necesites la aprobación de la persona que te gusta para sentirte bien contigo mismo, y que decir que no te resulte especialmente difícil.",
        "Es probable que necesites la aprobación de la persona que te gusta para sentirte bien contigo misma, y que decir que no te resulte especialmente difícil.",
        "Es probable que necesites la aprobación de la persona que te gusta para sentirte bien contigo, y que decir que no te resulte especialmente difícil."
      ),
      rec: [
        gv(
          "Identifica una actividad, logro o conexión que te haga sentir valioso sin relación de por medio, y dale tiempo regular.",
          "Identifica una actividad, logro o conexión que te haga sentir valiosa sin relación de por medio, y dale tiempo regular.",
          "Identifica una actividad, logro o conexión que te haga sentir tu propio valor sin que una relación esté de por medio, y dale tiempo regular."
        ),
        "Practica poner un límite pequeño esta semana, aunque te genere incomodidad.",
        "Si notar tu propio valor te resulta muy difícil de forma constante, un espacio de acompañamiento terapéutico puede ayudar a trabajar esta base.",
      ],
    },
    en: {
      f: "Your sense of worth doesn't depend on having a partner or on constant approval from the person you're interested in. You can set boundaries without fearing you'll lose the relationship. This foundation protects you from staying in relationships out of fear of being alone — keep reinforcing it with activities and bonds that remind you of your worth outside the relationship.",
      m: "You generally feel valuable regardless of how a relationship is going, though saying no to something that makes you uncomfortable may cost you more than you'd like. Practicing small boundaries in low-risk contexts strengthens this foundation.",
      d: "You likely need approval from the person you like to feel good about yourself, and saying no may feel especially hard.",
      rec: [
        "Identify an activity, achievement, or relationship that makes you feel valuable with no romantic relationship involved, and give it regular time.",
        "Practice setting one small boundary this week, even if it feels uncomfortable.",
        "If noticing your own worth is consistently difficult, therapeutic support can help work on this foundation.",
      ],
    },
  },
  IA: {
    es: {
      f: "Puedes mostrar tus miedos, inseguridades y experiencias difíciles a alguien que te interesa de verdad, sin necesidad de mantener una imagen perfecta. Esa apertura es lo que permite que una relación se vuelva profunda en vez de quedarse en la superficie — sigue eligiendo compartir, incluso cuando da algo de vértigo.",
      m: "Puedes abrirte emocionalmente en la mayoría de los casos, aunque hay temas o momentos donde prefieres mantener una imagen más controlada. Notar cuáles son esos temas específicos es un buen punto de partida para trabajarlos.",
      d: gv(
        "Es probable que prefieras mantener una imagen controlada de ti mismo antes que mostrar tus vulnerabilidades, incluso con alguien que te interesa genuinamente.",
        "Es probable que prefieras mantener una imagen controlada de ti misma antes que mostrar tus vulnerabilidades, incluso con alguien que te interesa genuinamente.",
        "Es probable que prefieras mantener una imagen controlada de tu persona antes que mostrar tus vulnerabilidades, incluso con alguien que te interesa genuinamente."
      ),
      rec: [
        "Elige una persona de confianza y comparte algo pequeño pero real sobre ti que normalmente no compartirías.",
        "Nota qué sucede en tu cuerpo cuando alguien intenta conocerte más a fondo, y practica quedarte en la conversación un poco más de lo que te resulta cómodo.",
        "Si te cuesta identificar tus propias emociones para poder compartirlas, trabajarlo en terapia individual puede ser un buen punto de partida.",
      ],
    },
    en: {
      f: "You can show your fears, insecurities, and difficult experiences to someone you're genuinely interested in, without needing to keep up a perfect image. That openness is what allows a relationship to become deep rather than staying on the surface — keep choosing to share, even when it feels a little vertiginous.",
      m: "You can open up emotionally in most situations, though there are certain topics or moments where you'd rather keep a more controlled image. Noticing exactly which topics those are is a good starting point for working on them.",
      d: "You likely prefer to keep a controlled image of yourself rather than show your vulnerabilities, even with someone you're genuinely interested in.",
      rec: [
        "Choose someone you trust and share something small but real about yourself that you wouldn't normally share.",
        "Notice what happens in your body when someone tries to get to know you more deeply, and practice staying in the conversation a little longer than feels comfortable.",
        "If identifying your own emotions well enough to share them is hard, working on it in individual therapy can be a good starting point.",
      ],
    },
  },
  CV: {
    es: {
      f: "Tienes claridad sobre qué papel quieres que ocupe una relación en tu vida, qué es no negociable para ti y cuáles son tus prioridades más allá de la pareja. Esa claridad te permite elegir relaciones con criterio, en vez de dejarte llevar solo por la atracción inicial — sigue revisando estas prioridades a medida que tu vida cambia.",
      m: "Tienes una idea general de lo que buscas en una relación, aunque hay zonas menos definidas —qué es negociable y qué no, por ejemplo— que conviene precisar antes de comprometerte más a fondo con alguien.",
      d: "Es probable que no tengas del todo claro qué esperas de una relación en esta etapa de tu vida, y que sueles dejar que sea la otra persona quien defina el rumbo de la relación.",
      rec: [
        "Dedica un momento a escribir, sin filtro, qué papel quieres que tenga una pareja en tu vida en los próximos 2-3 años.",
        "Identifica al menos tres cosas que son no negociables para ti en una relación.",
        "Antes de involucrarte más profundamente con alguien, revisa si sus planes de vida son compatibles con los tuyos, no solo si hay atracción.",
      ],
    },
    en: {
      f: "You're clear about what role you want a relationship to play in your life, what's non-negotiable for you, and what your priorities are beyond a partner. That clarity lets you choose relationships with judgment, rather than being driven only by initial attraction — keep revisiting these priorities as your life changes.",
      m: "You have a general sense of what you're looking for in a relationship, though there are less defined areas — what's negotiable and what isn't, for example — worth clarifying before committing more deeply to someone.",
      d: "You likely aren't entirely clear on what you expect from a relationship at this stage of your life, and you tend to let the other person define the relationship's direction.",
      rec: [
        "Take time to write, without filtering, what role you want a partner to play in your life over the next 2-3 years.",
        "Identify at least three things that are non-negotiable for you in a relationship.",
        "Before getting more deeply involved with someone, check whether their life plans are compatible with yours, not just whether there's attraction.",
      ],
    },
  },
};

const BAND_LABELS = {
  d: { es: "Área de desarrollo", en: "Area for development" },
  m: { es: "Funcional", en: "Functional" },
  f: { es: "Fortaleza", en: "Strength" },
};

// Devuelve { text, recommendations } ya resuelto por género para dimensión+banda.
function getBandContent(dimCode, band, lang, gender) {
  const c = CONTENT[dimCode][lang];
  const block = c[band];
  const text = resolveGender(block, gender);
  const recommendations = band === "d" ? c.rec.map((r) => resolveGender(r, gender)) : [];
  return { text, recommendations, bandLabel: BAND_LABELS[band][lang] };
}

const SOCIAL_DESIRABILITY_NOTE = {
  es: "Algunas de tus respuestas sugieren que pudiste haber respondido pensando en dar una buena impresión más que en describirte con exactitud. Te invitamos a repetir el test en un momento de mayor calma, respondiendo lo más honestamente posible: el informe es solo para ti.",
  en: "Some of your answers suggest you may have responded with an eye toward making a good impression rather than describing yourself accurately. We invite you to retake the test at a calmer moment, answering as honestly as possible: this report is for you alone.",
};

const REFERRAL_MESSAGE = {
  es: "Tus respuestas muestran un patrón que sugiere que podrías estar pasando por un momento emocionalmente difícil. El Índice de Desarrollo y Fortalecimiento Relacional no es una herramienta de diagnóstico ni de crisis. Si sientes que necesitas apoyo ahora, te recomendamos hablar con un profesional de salud mental o con alguien de confianza lo antes posible.",
  en: "Your answers show a pattern that suggests you may be going through an emotionally difficult time. The Relationship Development and Strengthening Index is not a diagnostic or crisis tool. If you feel you need support right now, we recommend speaking with a mental health professional or someone you trust as soon as possible.",
};

module.exports = {
  CONTENT,
  BAND_LABELS,
  getBandContent,
  resolveGender,
  isGV,
  SOCIAL_DESIRABILITY_NOTE,
  REFERRAL_MESSAGE,
};
