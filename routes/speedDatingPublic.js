// routes/speedDatingPublic.js
//
// Endpoints públicos (sin login) que usa el celular de cada asistente:
// registro, y el "estado" en vivo que alimenta la pantalla única de
// voto/mesa/cambio de mesa/resultados (ver adenda v3 — el servidor es la
// única fuente de verdad sobre en qué ronda está el evento, cada celular
// solo consulta, cada ~5s, mientras la pantalla está abierta). Se monta en
// server.js bajo /api/speed-dating.

const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const db = require("../db/init");
const { renumberGender } = require("../services/speedDatingAttendees");
const { sendMail } = require("../services/graphMail");
const { speedDatingWelcomeEmail } = require("../services/emailTemplates");

router.use(express.json());

function findEvent(id) {
  return db.prepare("SELECT * FROM sd_events WHERE id = ?").get(id);
}

// GET /api/speed-dating/events/:eventId/meta — para la pantalla de registro.
router.get("/events/:eventId/meta", (req, res) => {
  const event = findEvent(req.params.eventId);
  if (!event) return res.status(404).json({ error: "Evento no encontrado." });
  const registered = db.prepare("SELECT COUNT(*) AS n FROM sd_attendees WHERE event_id = ? AND cancelled_at IS NULL").get(event.id).n;
  res.json({
    id: event.id,
    name: event.name,
    status: event.status,
    capacity: event.capacity,
    registered,
    cuposDisponibles: Math.max(0, event.capacity - registered),
    venueName: event.venue_name || null,
    venueAddress: event.venue_address || null,
    minAge: event.min_age || null,
    maxAge: event.max_age || null,
  });
});

// POST /api/speed-dating/events/:eventId/registro — registro de un asistente.
router.post("/events/:eventId/registro", (req, res) => {
  const event = findEvent(req.params.eventId);
  if (!event) return res.status(404).json({ error: "Evento no encontrado." });
  if (event.status !== "registro") {
    return res.status(400).json({ error: "El registro para este evento ya está cerrado." });
  }

  const { name, email, phone, gender, sharePhoneConsent } = req.body || {};

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "El nombre es obligatorio." });
  }
  if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: "El correo no es válido." });
  }
  if (!phone || typeof phone !== "string" || !phone.trim()) {
    return res.status(400).json({ error: "El teléfono/WhatsApp es obligatorio." });
  }
  if (gender !== "M" && gender !== "F") {
    return res.status(400).json({ error: "Selecciona tu género para poder asignarte una mesa." });
  }

  // Edad obligatoria y, si el evento tiene un rango configurado (sd_events
  // .min_age / .max_age — ver routes/speedDatingAdmin.js), se hace cumplir
  // aquí. Un evento sin rango configurado (ambos NULL) no bloquea a nadie
  // por edad — así los eventos creados antes de este cambio no se rompen.
  const age = Number(req.body && req.body.age);
  if (!Number.isInteger(age) || age < 1 || age > 120) {
    return res.status(400).json({ error: "La edad es obligatoria." });
  }
  if ((event.min_age && age < event.min_age) || (event.max_age && age > event.max_age)) {
    const rangeLabel =
      event.min_age && event.max_age
        ? `de ${event.min_age} a ${event.max_age} años`
        : event.min_age
        ? `de ${event.min_age} años en adelante`
        : `hasta ${event.max_age} años`;
    return res.status(400).json({ error: `Este evento es para personas ${rangeLabel}.` });
  }

  const registered = db.prepare("SELECT COUNT(*) AS n FROM sd_attendees WHERE event_id = ? AND cancelled_at IS NULL").get(event.id).n;
  if (registered >= event.capacity) {
    return res.status(400).json({ error: "Este evento ya alcanzó su aforo máximo." });
  }

  const sameGenderCount = db
    .prepare("SELECT COUNT(*) AS n FROM sd_attendees WHERE event_id = ? AND gender = ? AND cancelled_at IS NULL")
    .get(event.id, gender).n;

  const id = crypto.randomUUID();
  const voteToken = crypto.randomUUID();
  const tableNumber = gender === "F" ? sameGenderCount + 1 : null;
  const seatIndex = sameGenderCount;

  db.prepare(
    `INSERT INTO sd_attendees
      (id, event_id, created_at, name, email, phone, gender, share_phone_consent, table_number, seat_index, vote_token, age)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    event.id,
    new Date().toISOString(),
    name.trim(),
    email.trim(),
    phone.trim(),
    gender,
    sharePhoneConsent ? 1 : 0,
    tableNumber,
    seatIndex,
    voteToken,
    age
  );

  // Correo de bienvenida automático — no bloquea la respuesta del registro
  // (si falla el envío, el registro ya quedó guardado igual; el error solo
  // se registra en consola, sin reintento automático como sí tiene el
  // correo de resultados de 48h).
  try {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const asistenteUrl = `${baseUrl}/speed-dating/asistente.html?token=${voteToken}`;
    const { subject, html } = speedDatingWelcomeEmail({
      name: name.trim(),
      lang: "es",
      gender,
      eventName: event.name,
      eventDate: event.event_date,
      venueName: event.venue_name,
      venueAddress: event.venue_address,
      minAge: event.min_age,
      maxAge: event.max_age,
      tableNumber,
      asistenteUrl,
    });
    sendMail({ to: email.trim(), subject, html }).catch((err) => {
      console.error("[speedDatingPublic] Error enviando correo de bienvenida —", err.message);
    });
  } catch (err) {
    console.error("[speedDatingPublic] Error preparando correo de bienvenida —", err.message);
  }

  res.json({ ok: true, voteToken, tableNumber, gender });
});

function loadAttendeeByToken(token) {
  return db.prepare("SELECT * FROM sd_attendees WHERE vote_token = ?").get(token);
}

// Pregunta de conversación de una ronda dada (1-indexed) — Francisco la
// escribe al crear/editar el evento (sd_events.round_questions, una por
// línea, ver routes/speedDatingAdmin.js). La misma pregunta se entrega a
// todas las mesas esa ronda; si el organizador escribió menos preguntas
// que rondas terminó teniendo el evento, las rondas sin pregunta propia
// simplemente no muestran ninguna (no se inventa ni se repite nada).
function roundQuestion(event, roundNumber) {
  if (!event.round_questions || !roundNumber || roundNumber < 1) return null;
  const list = event.round_questions
    .split("\n")
    .map((q) => q.trim())
    .filter(Boolean);
  return list[roundNumber - 1] || null;
}

// Busca el pairing (mesa+pareja) de un asistente para una ronda dada.
// Para mujeres siempre existe una fila (su mesa es fija); para hombres, si
// no hay fila es que esa ronda descansan (aforo desigual) — ver
// services/speedDatingMatch.js.
function pairingForRound(eventId, attendee, roundNumber) {
  if (!roundNumber || roundNumber < 1) return null;
  if (attendee.gender === "F") {
    return db
      .prepare("SELECT * FROM sd_pairings WHERE event_id = ? AND round_number = ? AND woman_id = ?")
      .get(eventId, roundNumber, attendee.id);
  }
  return db
    .prepare("SELECT * FROM sd_pairings WHERE event_id = ? AND round_number = ? AND man_id = ?")
    .get(eventId, roundNumber, attendee.id);
}

// GET /api/speed-dating/attendee/:token/estado — polling cada ~5s.
router.get("/attendee/:token/estado", (req, res) => {
  const attendee = loadAttendeeByToken(req.params.token);
  if (!attendee) return res.status(404).json({ error: "No encontramos tu registro — revisa el link." });
  const event = findEvent(attendee.event_id);
  if (!event) return res.status(404).json({ error: "Evento no encontrado." });

  const base = {
    evento_nombre: event.name,
    evento_estado: event.status === "finalizado" ? "finalizado" : event.round_state,
    ronda_actual: event.current_round_number,
    total_rondas: event.total_rounds,
    mi_nombre: attendee.name,
    mi_genero: attendee.gender,
    evento_fecha: event.event_date || null,
    evento_lugar: event.venue_name || null,
    evento_lugar_direccion: event.venue_address || null,
  };

  // Cancelado tiene prioridad sobre cualquier otro estado del evento: si ya
  // canceló su participación (POST /attendee/:token/cancelar), su pantalla
  // debe mostrar eso sin importar si el evento sigue en registro o ya
  // inició sin ella/él.
  if (attendee.cancelled_at) {
    return res.json({ ...base, evento_estado: "cancelado", motivo: attendee.cancellation_reason || null, mi_mesa: null, descansa: false });
  }

  if (event.status === "registro") {
    return res.json({ ...base, evento_estado: "esperando_inicio", mi_mesa: attendee.table_number, descansa: false });
  }

  if (event.status === "finalizado") {
    const isWoman = attendee.gender === "F";
    const matchRows = db
      .prepare(`SELECT * FROM sd_matches WHERE event_id = ? AND ${isWoman ? "woman_id" : "man_id"} = ?`)
      .all(event.id, attendee.id);
    const matches = matchRows.map((m) => {
      const partnerId = isWoman ? m.man_id : m.woman_id;
      const partner = db.prepare("SELECT name, phone, share_phone_consent FROM sd_attendees WHERE id = ?").get(partnerId);
      return {
        nombre: partner ? partner.name : "—",
        telefono: partner && partner.share_phone_consent ? partner.phone : null,
      };
    });
    return res.json({ ...base, evento_estado: "finalizado", mi_mesa: null, descansa: false, matches });
  }

  // status === 'en_curso'
  const isTransition = event.round_state === "cambio_de_mesa";
  const isLastTransition = isTransition && event.current_round_number >= (event.total_rounds || 0);

  if (isLastTransition) {
    return res.json({ ...base, evento_estado: "cambio_de_mesa", cierre_inminente: true, mi_mesa: null, descansa: false });
  }

  // Mujeres: su mesa nunca cambia. Hombres: durante 'ronda_activa' se
  // muestra la mesa de la ronda en curso; durante 'cambio_de_mesa' ya se
  // muestra la mesa de la ronda SIGUIENTE, para que le dé tiempo de
  // caminar antes de que se reactive el voto (ver adenda v3, sección 3).
  const roundToShow = attendee.gender === "M" && isTransition ? event.current_round_number + 1 : event.current_round_number;
  const pairing = pairingForRound(event.id, attendee, roundToShow);

  let miMesa = null;
  let descansa = false;
  if (attendee.gender === "F") {
    miMesa = attendee.table_number;
    descansa = !!pairing && pairing.man_id === null;
  } else if (pairing) {
    miMesa = pairing.table_number;
  } else {
    descansa = true;
  }

  let yaVote = false;
  const votingPairing = pairingForRound(event.id, attendee, event.current_round_number);
  if (event.round_state === "ronda_activa" && votingPairing) {
    const existing = db
      .prepare("SELECT 1 FROM sd_votes WHERE pairing_id = ? AND voter_attendee_id = ?")
      .get(votingPairing.id, attendee.id);
    yaVote = !!existing;
  }

  res.json({
    ...base,
    mi_mesa: miMesa,
    descansa,
    ya_vote: yaVote,
    pairing_id: event.round_state === "ronda_activa" ? (votingPairing ? votingPairing.id : null) : null,
    pregunta_ronda: event.round_state === "ronda_activa" ? roundQuestion(event, event.current_round_number) : null,
    pregunta_siguiente: isTransition ? roundQuestion(event, event.current_round_number + 1) : null,
  });
});

// POST /api/speed-dating/attendee/:token/cancelar — { reason }. Solo
// mientras el evento sigue en "registro" — una vez iniciado, las mesas y
// rondas ya quedaron fijas en sd_pairings (ver services/speedDatingMatch.js)
// así que cancelar ya no tiene el mismo efecto y se maneja en persona con
// el organizador. No borra la fila: la marca como cancelada con el motivo,
// para que quede el historial en el panel del organizador (routes/
// speedDatingAdmin.js), y libera su cupo y su lugar en la numeración de
// mesas (services/speedDatingAttendees.js) para que otra persona pueda
// registrarse en su lugar.
router.post("/attendee/:token/cancelar", (req, res) => {
  const attendee = loadAttendeeByToken(req.params.token);
  if (!attendee) return res.status(404).json({ error: "No encontramos tu registro — revisa el link." });
  const event = findEvent(attendee.event_id);
  if (!event) return res.status(404).json({ error: "Evento no encontrado." });

  if (attendee.cancelled_at) {
    return res.json({ ok: true });
  }
  if (event.status !== "registro") {
    return res.status(400).json({ error: "El evento ya inició — ya no se puede cancelar desde aquí. Escríbele directo al organizador." });
  }

  const reason = (req.body && typeof req.body.reason === "string" ? req.body.reason : "").trim();
  if (!reason) {
    return res.status(400).json({ error: "Cuéntanos brevemente el motivo para poder cancelar tu registro." });
  }

  db.prepare("UPDATE sd_attendees SET cancelled_at = ?, cancellation_reason = ? WHERE id = ?").run(
    new Date().toISOString(),
    reason,
    attendee.id
  );
  renumberGender(event.id, attendee.gender);

  res.json({ ok: true });
});

// POST /api/speed-dating/attendee/:token/vote — { vote: 'si' | 'no' }
router.post("/attendee/:token/vote", (req, res) => {
  const attendee = loadAttendeeByToken(req.params.token);
  if (!attendee) return res.status(404).json({ error: "No encontramos tu registro." });
  const event = findEvent(attendee.event_id);
  if (!event || event.status !== "en_curso" || event.round_state !== "ronda_activa") {
    return res.status(400).json({ error: "En este momento no se puede votar — espera a que empiece la ronda." });
  }

  const vote = req.body && req.body.vote;
  if (vote !== "si" && vote !== "no") {
    return res.status(400).json({ error: "Voto inválido." });
  }

  const pairing = pairingForRound(event.id, attendee, event.current_round_number);
  if (!pairing) {
    return res.status(400).json({ error: "Esta ronda no te toca mesa — nada que votar." });
  }

  db.prepare(
    `INSERT INTO sd_votes (id, pairing_id, voter_attendee_id, vote, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(pairing_id, voter_attendee_id) DO UPDATE SET vote = excluded.vote`
  ).run(crypto.randomUUID(), pairing.id, attendee.id, vote, new Date().toISOString());

  res.json({ ok: true });
});

module.exports = router;
