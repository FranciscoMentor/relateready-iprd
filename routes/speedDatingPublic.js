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

router.use(express.json());

function findEvent(id) {
  return db.prepare("SELECT * FROM sd_events WHERE id = ?").get(id);
}

// GET /api/speed-dating/events/:eventId/meta — para la pantalla de registro.
router.get("/events/:eventId/meta", (req, res) => {
  const event = findEvent(req.params.eventId);
  if (!event) return res.status(404).json({ error: "Evento no encontrado." });
  const registered = db.prepare("SELECT COUNT(*) AS n FROM sd_attendees WHERE event_id = ?").get(event.id).n;
  res.json({
    id: event.id,
    name: event.name,
    status: event.status,
    capacity: event.capacity,
    registered,
    cuposDisponibles: Math.max(0, event.capacity - registered),
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

  const registered = db.prepare("SELECT COUNT(*) AS n FROM sd_attendees WHERE event_id = ?").get(event.id).n;
  if (registered >= event.capacity) {
    return res.status(400).json({ error: "Este evento ya alcanzó su aforo máximo." });
  }

  const sameGenderCount = db
    .prepare("SELECT COUNT(*) AS n FROM sd_attendees WHERE event_id = ? AND gender = ?")
    .get(event.id, gender).n;

  const id = crypto.randomUUID();
  const voteToken = crypto.randomUUID();
  const tableNumber = gender === "F" ? sameGenderCount + 1 : null;
  const seatIndex = sameGenderCount;

  db.prepare(
    `INSERT INTO sd_attendees
      (id, event_id, created_at, name, email, phone, gender, share_phone_consent, table_number, seat_index, vote_token)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
    voteToken
  );

  res.json({ ok: true, voteToken, tableNumber, gender });
});

function loadAttendeeByToken(token) {
  return db.prepare("SELECT * FROM sd_attendees WHERE vote_token = ?").get(token);
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
  };

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
  });
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
