const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const DB_PATH = process.env.DB_PATH || "./db/relateready.sqlite";

// Asegura que el directorio del archivo exista (útil para el disco
// persistente de Render, montado en /var/data).
const dir = path.dirname(DB_PATH);
if (dir && dir !== "." && !fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    name TEXT NOT NULL,
    lang TEXT NOT NULL,
    gender TEXT NOT NULL,
    relationship_context_code TEXT NOT NULL,
    relationship_context_text TEXT NOT NULL,
    core_responses TEXT NOT NULL,
    desirability_responses TEXT NOT NULL,
    vignette_responses TEXT,
    qualitative_answers TEXT,
    score_result TEXT NOT NULL,
    referral_triggered INTEGER NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'pending',
    payment_reference TEXT,
    extended_generated_at TEXT
  );
`);

// ── Migraciones incrementales del panel-control (2026-08) ─────────────────
// Igual que hace el panel de referencia de SQ Assessment: se revisa qué
// columnas existen ya en la tabla antes de agregar, así este bloque es
// seguro de ejecutar en cada arranque del servidor, tanto en local como en
// cada despliegue nuevo en Render (nunca destruye datos existentes).
//
// Columnas nuevas:
//  - email / phone: para poder dar seguimiento comercial real por persona
//    desde el panel (antes solo existía "name"). Se agregan también al
//    formulario del test (routes/api.js + public/js/app.js) como opcionales.
//  - follow_up_status / follow_up_notes: estado de seguimiento comercial
//    editable desde el panel (chips + notas), mismo patrón que el panel de
//    referencia. "nuevo" es el estado inicial de cualquier envío existente.
const existingColumns = db.prepare("PRAGMA table_info(submissions)").all().map((c) => c.name);
function addColumnIfMissing(name, ddl) {
  if (!existingColumns.includes(name)) {
    db.exec(`ALTER TABLE submissions ADD COLUMN ${ddl}`);
    existingColumns.push(name);
  }
}
addColumnIfMissing("email", "email TEXT");
addColumnIfMissing("phone", "phone TEXT");
addColumnIfMissing("follow_up_status", "follow_up_status TEXT NOT NULL DEFAULT 'nuevo'");
addColumnIfMissing("follow_up_notes", "follow_up_notes TEXT");

// ── Migración: correo automático (2026-09) ────────────────────────────────
// reminder_sent_at: cuándo se envió (si se envió) el recordatorio de 24-48h
// a alguien que completó el test, dejó su correo, pero no compró el Informe
// Extendido — ver services/reminderScheduler.js. NULL = todavía no se le ha
// enviado nada.
addColumnIfMissing("reminder_sent_at", "reminder_sent_at TEXT");

// ── Migración: ciudad y país (2026-09) ────────────────────────────────────
// Se agregan como parte del rediseño de la página de inicio: correo,
// teléfono, ciudad y país pasan de opcionales a obligatorios (ver
// routes/api.js + public/js/app.js), porque el correo automático del
// Informe Extendido (Hueco 1) depende de que todo envío tenga un email.
addColumnIfMissing("city", "city TEXT");
addColumnIfMissing("country", "country TEXT");

// ── Migración: confirmación real de envío del correo del Informe Extendido (2026-09) ──
// Antes el envío del correo con el PDF adjunto era "dispara y olvida": si
// fallaba (como pasó con el client secret de Graph mal copiado), solo
// quedaba un log en Render que nadie veía, y el panel no tenía forma de
// saberlo. Ahora se guarda el resultado real de cada intento — ver
// services/extendedReport.js.
//  - extended_email_status: 'sent' | 'failed' | 'disabled' | NULL (NULL =
//    todavía no se ha intentado enviar, por ejemplo porque no ha pagado).
//  - extended_email_error: mensaje de error del intento más reciente (NULL
//    si el último intento fue exitoso o si nunca se ha intentado).
addColumnIfMissing("extended_email_status", "extended_email_status TEXT");
addColumnIfMissing("extended_email_error", "extended_email_error TEXT");


// ═══════════════════════════════════════════════════════════════════════
// Speed Dating (piloto Mila Rooftop, 2026-09) ─ tablas nuevas, propias del
// feature (no comparten filas con "submissions"). Se crean con CREATE TABLE
// IF NOT EXISTS, mismo criterio no-destructivo que el resto de este archivo,
// aunque al ser tablas nuevas (no columnas agregadas a una tabla existente)
// no hace falta el helper addColumnIfMissing.
//
// Modelo (ver propuesta técnica v2 y adenda v3 en /docs del proyecto):
//  - sd_events: un evento (ej. "Mila Rooftop — 20 sep"). Controla el estado
//    en vivo de las rondas (current_round_number / round_state) — el
//    servidor es la única fuente de verdad, no el reloj de cada celular.
//  - sd_attendees: cada persona registrada. Las mujeres reciben table_number
//    fijo al registrarse (nunca cambia); los hombres reciben seat_index
//    (su posición en la rotación) y su mesa se calcula por ronda.
//  - sd_pairings: el cruce mujer/hombre/mesa de cada ronda, precalculado de
//    una sola vez cuando el organizador cierra el registro e inicia el
//    evento (ver services/speedDatingMatch.js — fórmula CICLO=máx(M,W)).
//    man_id NULL = esa mesa descansa esa ronda (aforo desigual).
//  - sd_votes: un voto sí/no por persona por pairing (cada quien vota solo
//    su propia opinión sobre la otra persona de su mesa esa ronda).
//  - sd_matches: los cruces mutuos (ambos votaron "sí"), calculados al
//    finalizar el evento — es lo que alimenta tanto el informe inmediato
//    del organizador como el correo automático de resultados a las 48h.
db.exec(`
  CREATE TABLE IF NOT EXISTS sd_events (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    name TEXT NOT NULL,
    event_date TEXT,
    capacity INTEGER NOT NULL DEFAULT 24,
    status TEXT NOT NULL DEFAULT 'registro',
    round_state TEXT NOT NULL DEFAULT 'esperando_inicio',
    current_round_number INTEGER NOT NULL DEFAULT 0,
    total_rounds INTEGER,
    finalized_at TEXT
  );

  CREATE TABLE IF NOT EXISTS sd_attendees (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    gender TEXT NOT NULL,
    share_phone_consent INTEGER NOT NULL DEFAULT 0,
    table_number INTEGER,
    seat_index INTEGER NOT NULL,
    vote_token TEXT NOT NULL UNIQUE,
    match_email_status TEXT,
    match_email_error TEXT,
    match_email_sent_at TEXT
  );

  CREATE TABLE IF NOT EXISTS sd_pairings (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    round_number INTEGER NOT NULL,
    table_number INTEGER NOT NULL,
    woman_id TEXT NOT NULL,
    man_id TEXT
  );

  CREATE TABLE IF NOT EXISTS sd_votes (
    id TEXT PRIMARY KEY,
    pairing_id TEXT NOT NULL,
    voter_attendee_id TEXT NOT NULL,
    vote TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(pairing_id, voter_attendee_id)
  );

  CREATE TABLE IF NOT EXISTS sd_matches (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    woman_id TEXT NOT NULL,
    man_id TEXT NOT NULL,
    table_number INTEGER,
    round_number INTEGER,
    created_at TEXT NOT NULL,
    UNIQUE(event_id, woman_id, man_id)
  );

  CREATE INDEX IF NOT EXISTS idx_sd_attendees_event ON sd_attendees(event_id);
  CREATE INDEX IF NOT EXISTS idx_sd_pairings_event_round ON sd_pairings(event_id, round_number);
  CREATE INDEX IF NOT EXISTS idx_sd_votes_pairing ON sd_votes(pairing_id);
  CREATE INDEX IF NOT EXISTS idx_sd_matches_event ON sd_matches(event_id);
`);

// ── Migración: lugar del evento y aforo editable (2026-09) ───────────────
// venue_name / venue_address: Francisco organiza eventos en distintos
// lugares, ciudades y países, así que cada evento necesita su propio lugar
// (antes no existía este dato). La tabla sd_events ya existe en producción
// (creada arriba con CREATE TABLE IF NOT EXISTS), así que estas columnas se
// agregan con el mismo patrón addColumnIfMissing que usa el resto de este
// archivo — un CREATE TABLE IF NOT EXISTS no modifica una tabla que ya
// existe. El aforo (capacity) no es una columna nueva: ya existía y ahora
// se puede editar en cualquier momento vía POST /admin/speed-dating/:id/editar
// (routes/speedDatingAdmin.js), incluso a último momento antes de iniciar
// el evento.
const sdEventsColumns = db.prepare("PRAGMA table_info(sd_events)").all().map((c) => c.name);
function addSdEventsColumnIfMissing(name, ddl) {
  if (!sdEventsColumns.includes(name)) {
    db.exec(`ALTER TABLE sd_events ADD COLUMN ${ddl}`);
    sdEventsColumns.push(name);
  }
}
addSdEventsColumnIfMissing("venue_name", "venue_name TEXT");
addSdEventsColumnIfMissing("venue_address", "venue_address TEXT");

// ── Migración: preguntas de conversación por ronda (2026-09) ─────────────
// round_questions: Francisco escribe, al crear cada evento, una pregunta de
// conversación por ronda (basadas en el test RelateReady y el libro "Tú
// Primero") — se guardan como texto plano, una por línea, en orden (línea 1
// = Ronda 1, línea 2 = Ronda 2, etc). No se generan automáticamente ni
// salen del test de cada asistente — es contenido que el organizador
// redacta a mano, distinto en cada evento. Se entregan en vivo al celular
// de cada asistente durante la ronda activa (ver GET
// /api/speed-dating/attendee/:token/estado en routes/speedDatingPublic.js)
// — la misma pregunta para todas las mesas esa ronda.
addSdEventsColumnIfMissing("round_questions", "round_questions TEXT");

// ── Migración: rango de edad obligatorio del evento (2026-09) ────────────
// min_age / max_age: cada evento debe dirigirse a un rango de edad (ej. 25
// a 40 años) — se define al crear o editar el evento (routes/
// speedDatingAdmin.js) y se hace cumplir en el registro público (routes/
// speedDatingPublic.js): quien esté fuera del rango no puede registrarse.
// Un evento sin rango configurado (NULL) no bloquea ninguna edad — así los
// eventos creados antes de este cambio siguen funcionando igual que antes.
addSdEventsColumnIfMissing("min_age", "min_age INTEGER");
addSdEventsColumnIfMissing("max_age", "max_age INTEGER");

// ── Migración: edad de cada asistente (2026-09) ───────────────────────────
// age: la edad que la persona declaró al registrarse — se usa para hacer
// cumplir min_age/max_age (arriba) y queda guardada para que el organizador
// la vea en el panel. sd_attendees ya existe en producción, así que se
// agrega con el mismo patrón addColumnIfMissing, esta vez sobre esa tabla.
const sdAttendeesColumns = db.prepare("PRAGMA table_info(sd_attendees)").all().map((c) => c.name);
function addSdAttendeesColumnIfMissing(name, ddl) {
  if (!sdAttendeesColumns.includes(name)) {
    db.exec(`ALTER TABLE sd_attendees ADD COLUMN ${ddl}`);
    sdAttendeesColumns.push(name);
  }
}
addSdAttendeesColumnIfMissing("age", "age INTEGER");

// ── Migración: cancelación de participación por el propio asistente (2026-09) ─
// cancelled_at / cancellation_reason: cualquiera que se registre puede,
// desde su propia pantalla (public/speed-dating/asistente.html), cancelar
// su participación y decir por qué — útil porque mucha gente se registra
// varios días antes del evento y a veces no puede llegar. No se borra la
// fila (a diferencia de "Eliminar" en el panel del organizador): se
// conserva el registro con el motivo para que quede el historial, pero se
// excluye de la numeración de mesas (ver services/speedDatingAttendees.js)
// y del cupo disponible (routes/speedDatingPublic.js) — como si nunca
// hubiera ocupado un lugar. Solo se puede cancelar mientras el evento
// sigue en "registro" (routes/speedDatingPublic.js, POST
// /attendee/:token/cancelar); una vez iniciado el evento las mesas y
// rondas ya quedaron fijas en sd_pairings.
addSdAttendeesColumnIfMissing("cancelled_at", "cancelled_at TEXT");
addSdAttendeesColumnIfMissing("cancellation_reason", "cancellation_reason TEXT");

module.exports = db;
