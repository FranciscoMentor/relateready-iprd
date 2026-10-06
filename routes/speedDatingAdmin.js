// routes/speedDatingAdmin.js
//
// Panel del organizador para el piloto de speed dating (Mila Rooftop): crear
// eventos, ver asistentes, iniciar el evento (bloquea el registro y genera
// el calendario de rondas), controlar el avance de rondas en vivo, y
// consultar el informe de matching en cualquier momento — sin depender del
// correo automático de 48h (services/speedDatingScheduler.js). Se monta en
// server.js bajo /admin/speed-dating, protegido con el mismo requireAuth de
// sesión que el resto del panel (ver routes/admin.js).

const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const db = require("../db/init");
const ExcelJS = require("exceljs");
const { generateSchedule, computeMutualMatches, persistMatches } = require("../services/speedDatingMatch");
const { renumberGender } = require("../services/speedDatingAttendees");
const { sendMail } = require("../services/graphMail");
const { speedDatingMatchEmail } = require("../services/emailTemplates");
const speedDatingReminderScheduler = require("../services/speedDatingReminderScheduler");
const speedDatingScheduler = require("../services/speedDatingScheduler");
const speedDatingSurveyScheduler = require("../services/speedDatingSurveyScheduler");

// Paleta oficial de marca (la misma que ya usa el resto del sitio en
// public/css/styles.css :root, y la que Francisco confirmó como paleta
// oficial: Fondo Crema #F4F0E9, Texto/Trazos Tinta #2A2A28, Acento
// Dorado/Ámbar #B5732A, Eyebrow/Subtextos Gris #6B6259 — más accentSoft,
// el tono claro del acento que ya usa el wireframe interactivo para las
// mismas insignias "eyebrow" (ver scratchpad del wireframe).
const BRAND = {
  accent: "#B5732A",
  accentDark: "#8f5920",
  accentSoft: "#E8D4BC",
  ink: "#2A2A28",
  muted: "#6B6259",
  green: "#3F6B4F",
  clay: "#9C3B2E",
  cream: "#F4F0E9",
  light: "#ECE4D6",
  border: "#DDD6CE",
};

function esc(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// renumberGender ahora vive en services/speedDatingAttendees.js — se
// comparte con el flujo público de cancelación (routes/
// speedDatingPublic.js), que también necesita renumerar mesas al liberar
// el cupo de alguien que cancela.

// Convierte el texto plano guardado en sd_events.round_questions (una
// pregunta por línea) en un arreglo ordenado — índice 0 = Ronda 1. Se
// reutiliza tanto para renderizar el panel del organizador como, en
// routes/speedDatingPublic.js, para entregarla al celular de cada
// asistente durante la ronda activa.
function parseRoundQuestions(text) {
  if (!text) return [];
  return text
    .split("\n")
    .map((q) => q.trim())
    .filter(Boolean);
}

function baseStyles() {
  return `
    *{box-sizing:border-box;font-family:Arial,"Helvetica Neue",Helvetica,"Segoe UI",sans-serif;}
    body{margin:0;background:${BRAND.cream};color:${BRAND.ink};}
    a{color:inherit;}
    header.topbar{background:${BRAND.ink};color:#fff;padding:16px 24px;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;}
    header.topbar .brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:14px;}
    header.topbar nav{display:flex;gap:18px;align-items:center;font-size:12.5px;}
    header.topbar nav a{color:${BRAND.light};text-decoration:none;}
    header.topbar nav a:hover{color:#fff;}
    .container{padding:28px;max-width:1100px;margin:0 auto;}
    .card{background:#fff;border:1px solid ${BRAND.border};border-radius:12px;padding:22px 24px;margin-bottom:20px;}
    .btn{padding:10px 18px;background:${BRAND.accent};color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;}
    .btn:hover{background:${BRAND.accentDark};}
    .btn.ghost{background:transparent;border:1px solid ${BRAND.border};color:${BRAND.ink};}
    .btn.danger{background:${BRAND.clay};}
    .btn.small{padding:6px 12px;font-size:11.5px;}
    .btn[disabled]{opacity:.4;cursor:not-allowed;}
    table{width:100%;border-collapse:collapse;background:#fff;font-size:13px;}
    th{background:${BRAND.ink};color:${BRAND.light};font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;padding:10px 12px;text-align:left;}
    td{padding:10px 12px;border-bottom:1px solid ${BRAND.border};vertical-align:top;}
    tr:last-child td{border-bottom:none;}
    .muted{color:${BRAND.muted};font-size:12px;}
    .badge{color:#fff;font-size:10.5px;padding:4px 10px;border-radius:100px;display:inline-block;}
    .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px;}
    .stat-card{background:#fff;border:1px solid ${BRAND.border};border-radius:12px;padding:16px 18px;}
    .stat-num{font-size:24px;font-weight:700;color:${BRAND.accent};}
    .stat-label{font-size:10.5px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:.05em;margin-top:4px;}
    input[type=text],input[type=number],input[type=date]{padding:9px 12px;border:1px solid ${BRAND.border};border-radius:8px;font-size:13px;}
    .link-box{background:${BRAND.light};border-radius:8px;padding:10px 14px;font-size:13px;word-break:break-all;margin-top:6px;}
    .round-state{font-size:15px;font-weight:700;color:${BRAND.accent};}
    form.inline{display:inline;}

    /* ── Componentes de marca (paleta oficial + tipografía palo seco) ──── */
    .eyebrow{
      display:inline-flex; align-items:center; gap:6px;
      font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;
      color:${BRAND.accentDark}; background:${BRAND.accentSoft};
      padding:5px 13px; border-radius:999px; margin-bottom:14px;
    }
    .page-head{margin-bottom:22px;}
    .page-head h1{margin:0 0 8px;font-size:26px;color:${BRAND.ink};letter-spacing:-0.01em;}
    .page-head .lede{margin:0;color:${BRAND.muted};font-size:14.5px;line-height:1.6;max-width:640px;}
    .accent-word{color:${BRAND.accent};}

    @media (max-width:700px){.stats{grid-template-columns:repeat(2,1fr);}.container{padding:16px;}}
  `;
}

function topbar() {
  return `
    <header class="topbar">
      <div class="brand" style="letter-spacing:.03em;">RelateReady <span style="color:${BRAND.light};font-weight:400;">· Speed Dating</span></div>
      <nav>
        <a href="/admin/speed-dating">Eventos</a>
        <a href="/panel-control">Panel de control</a>
        <a href="/admin/logout">Cerrar sesión</a>
      </nav>
    </header>`;
}

function baseUrlOf(req) {
  return `${req.protocol}://${req.get("host")}`;
}

// Normaliza el teléfono guardado (la gente lo escribe con o sin +593, con o
// sin el 0 inicial, con espacios) al formato que espera el enlace público
// de WhatsApp (wa.me/<código de país><número, sin 0 inicial>). Asume Ecuador
// (593) porque es el único mercado de estos eventos por ahora — si el
// número ya trae 593 lo deja igual.
function waPhoneDigits(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("593")) return digits;
  if (digits.startsWith("0")) return "593" + digits.slice(1);
  return "593" + digits;
}

// Un celular ecuatoriano válido para WhatsApp, ya limpio (ver arriba), debe
// quedar en exactamente 12 dígitos empezando con "5939" (593 + el 9 con el
// que arrancan los celulares aquí, sin el 0 inicial). Cualquier otra cosa
// (muy corto, muy largo, o texto que no dejó dígitos) se marca como
// sospechoso en el panel para que el organizador lo revise antes del
// evento — no bloquea el registro ni el envío, solo avisa.
function looksLikeValidEcuadorMobile(digits) {
  return digits.length === 12 && digits.startsWith("5939");
}

function formatEventDateEs(eventDate) {
  if (!eventDate) return null;
  return new Date(`${eventDate}T00:00:00`).toLocaleDateString("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// "20:00" (lo que produce un <input type="time">) -> "8:00 p.m.", para
// mostrarla junto a la fecha en el mensaje de WhatsApp y en el encabezado
// del panel. NULL si el evento no tiene hora configurada.
function formatEventTimeEs(eventTime) {
  if (!eventTime) return null;
  const [h, m] = eventTime.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const period = h >= 12 ? "p.m." : "a.m.";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

// Mensaje que se manda por WhatsApp al hacer clic en "Enviar por WhatsApp"
// en el panel — lleva la misma información que ya recibió por correo al
// registrarse (evento, fecha, lugar, mesa si ya la tiene, y su link
// personal), para que sirva igual si perdió el correo o no tiene la
// página abierta en su celular.
function buildWhatsappMessage({ attendee, event, asistenteUrl }) {
  const firstName = (attendee.name || "").trim().split(/\s+/)[0] || attendee.name;
  const formattedDate = formatEventDateEs(event.event_date);
  const formattedTime = formatEventTimeEs(event.event_time);
  const lines = [`Hola ${firstName} 👋 Soy del equipo de RelateReady.`, "", `Aquí está tu acceso a *${event.name}*:`];
  if (formattedDate) lines.push(`📅 ${formattedDate}${formattedTime ? ", " + formattedTime : ""}`);
  if (event.venue_name) lines.push(`📍 ${event.venue_name}${event.venue_address ? " — " + event.venue_address : ""}`);
  if (attendee.gender === "F" && attendee.table_number) lines.push(`🪩 Tu mesa fija: Mesa ${attendee.table_number}`);
  lines.push("", "Tu link personal para el evento (guárdalo, lo vas a necesitar esa noche):", asistenteUrl, "", "¡Te esperamos! 💛");
  return lines.join("\n");
}

// Página independiente para editar (o revisar antes de borrar) un asistente
// puntual — separada del tablero del evento para no llenar la tabla de
// formularios inline cuando puede haber más de veinte filas.
function renderAttendeeEditPage({ event, attendee, values, error }) {
  const canChangeGender = event.status === "registro";
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Editar asistente · ${esc(event.name)}</title>
<style>${baseStyles()}</style></head>
<body>
  ${topbar()}
  <div class="container" style="max-width:560px;">
    <div class="page-head">
      <span class="eyebrow">Editar asistente</span>
      <h1>${esc(values.name || attendee.name)}</h1>
      <p class="lede">${esc(event.name)}</p>
    </div>
    <div class="card">
      ${error ? `<p style="color:${BRAND.clay};font-weight:700;margin:0 0 16px;">${esc(error)}</p>` : ""}
      <form method="POST" action="/admin/speed-dating/${event.id}/attendees/${attendee.id}/editar" style="display:flex;flex-direction:column;gap:16px;">
        <label>Nombre<br><input type="text" name="name" value="${esc(values.name)}" style="width:100%;margin-top:4px;" required></label>
        <label>Correo<br><input type="text" name="email" value="${esc(values.email)}" style="width:100%;margin-top:4px;" required></label>
        <label>Teléfono/WhatsApp<br><input type="text" name="phone" value="${esc(values.phone)}" style="width:100%;margin-top:4px;" required></label>
        <label>Edad<br><input type="number" name="age" value="${esc(values.age)}" min="1" max="120" style="width:100%;margin-top:4px;" required></label>
        <label>Género<br>
          <select name="gender" ${canChangeGender ? "" : "disabled"} style="width:100%;margin-top:4px;padding:9px 12px;border:1px solid ${BRAND.border};border-radius:8px;font-size:13px;">
            <option value="F" ${values.gender === "F" ? "selected" : ""}>Mujer</option>
            <option value="M" ${values.gender === "M" ? "selected" : ""}>Hombre</option>
          </select>
          ${canChangeGender ? "" : `<span class="muted">El evento ya inició — el género ya no se puede cambiar porque las mesas ya están asignadas.</span>`}
        </label>
        <label style="display:flex;align-items:center;gap:8px;">
          <input type="checkbox" name="share_phone_consent" value="1" ${values.share_phone_consent ? "checked" : ""}>
          Autorizó compartir su WhatsApp si hay match
        </label>
        <div style="display:flex;gap:10px;margin-top:6px;">
          <button type="submit" class="btn">Guardar cambios</button>
          <a href="/admin/speed-dating/${event.id}" class="btn ghost">Cancelar</a>
        </div>
      </form>
    </div>
  </div>
</body></html>`;
}

const ROUND_STATE_LABEL = {
  esperando_inicio: "Esperando inicio",
  ronda_activa: "Ronda activa",
  cambio_de_mesa: "Cambio de mesa",
  finalizado: "Finalizado",
};
const STATUS_LABEL = {
  registro: "Registro abierto",
  en_curso: "Evento en curso",
  finalizado: "Finalizado",
};
const STATUS_COLOR = {
  registro: BRAND.accent,
  en_curso: BRAND.green,
  finalizado: BRAND.muted,
};

// ── Listado + creación de eventos ───────────────────────────────────────
function renderCreateForm(values = {}, error = null) {
  const v = {
    name: values.name || "",
    event_date: values.event_date || "",
    event_time: values.event_time || "",
    capacity: values.capacity || 24,
    venue_name: values.venue_name || "",
    venue_address: values.venue_address || "",
    min_age: values.min_age || "",
    max_age: values.max_age || "",
    round_questions: values.round_questions || "",
  };
  return `
    <div class="card">
      <h2 style="margin:0 0 14px;font-size:16px;">Crear nuevo evento</h2>
      ${error ? `<div style="background:#FBEAE7;border:1px solid ${BRAND.clay};color:${BRAND.clay};border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px;">${esc(error)}</div>` : ""}
      <form method="POST" action="/admin/speed-dating" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
        <div><label class="muted" style="display:block;margin-bottom:4px;">Nombre</label><input type="text" name="name" value="${esc(v.name)}" placeholder="Ej. Mila Rooftop — 20 sep" required></div>
        <div><label class="muted" style="display:block;margin-bottom:4px;">Fecha</label><input type="date" name="event_date" value="${esc(v.event_date)}"></div>
        <div><label class="muted" style="display:block;margin-bottom:4px;">Hora</label><input type="time" name="event_time" value="${esc(v.event_time)}" style="width:110px;"></div>
        <div><label class="muted" style="display:block;margin-bottom:4px;">Aforo máximo</label><input type="number" name="capacity" value="${esc(v.capacity)}" min="2" max="60" style="width:90px;"></div>
        <div><label class="muted" style="display:block;margin-bottom:4px;">Edad mínima</label><input type="number" name="min_age" value="${esc(v.min_age)}" placeholder="25" min="18" max="99" style="width:80px;"></div>
        <div><label class="muted" style="display:block;margin-bottom:4px;">Edad máxima</label><input type="number" name="max_age" value="${esc(v.max_age)}" placeholder="45" min="18" max="99" style="width:80px;"></div>
        <div><label class="muted" style="display:block;margin-bottom:4px;">Lugar</label><input type="text" name="venue_name" value="${esc(v.venue_name)}" placeholder="Ej. Mila Rooftop"></div>
        <div><label class="muted" style="display:block;margin-bottom:4px;">Dirección</label><input type="text" name="venue_address" value="${esc(v.venue_address)}" placeholder="Ciudad, dirección" style="min-width:220px;"></div>
        <div style="flex-basis:100%;">
          <label class="muted" style="display:block;margin-bottom:4px;">Preguntas de conversación por ronda (opcional)</label>
          <textarea name="round_questions" rows="4" style="width:100%;padding:9px 12px;border:1px solid ${BRAND.border};border-radius:8px;font-size:13px;font-family:inherit;" placeholder="Una pregunta por línea, en orden: la primera línea es la Ronda 1, la segunda la Ronda 2, etc. Básalas en el test y en el libro Tú Primero.">${esc(v.round_questions)}</textarea>
        </div>
        <button type="submit" class="btn">Crear evento</button>
      </form>
    </div>`;
}

// Renderiza la página de eventos (listado + formulario de creación). Si el
// POST de creación falla una validación, se vuelve a mostrar esta misma
// página con lo que la persona ya había escrito (values) y un mensaje de
// error — en vez de un formulario en blanco, que es lo que pasaba antes.
function sendEventsListPage(res, { values, error } = {}) {
  const events = db.prepare("SELECT * FROM sd_events ORDER BY created_at DESC").all();
  const rows = events
    .map((e) => {
      const counts = db
        .prepare("SELECT gender, COUNT(*) AS n FROM sd_attendees WHERE event_id = ? AND cancelled_at IS NULL GROUP BY gender")
        .all(e.id);
      const w = counts.find((c) => c.gender === "F");
      const m = counts.find((c) => c.gender === "M");
      const ageLabel = e.min_age && e.max_age ? `${e.min_age}–${e.max_age} años` : e.min_age ? `${e.min_age}+ años` : e.max_age ? `hasta ${e.max_age} años` : "";
      return `<tr>
        <td><a href="/admin/speed-dating/${e.id}" style="color:${BRAND.ink};font-weight:700;text-decoration:none;">${esc(e.name)}</a><br><span class="muted">${esc(e.event_date) || "sin fecha"}${e.event_time ? ", " + esc(formatEventTimeEs(e.event_time)) : ""}${e.venue_name ? " · " + esc(e.venue_name) : ""}${ageLabel ? " · " + ageLabel : ""}</span></td>
        <td><span class="badge" style="background:${STATUS_COLOR[e.status] || "#999"}">${STATUS_LABEL[e.status] || e.status}</span></td>
        <td>${w ? w.n : 0} mujeres · ${m ? m.n : 0} hombres</td>
        <td>${esc((e.created_at || "").slice(0, 16).replace("T", " "))}</td>
        <td><a href="/admin/speed-dating/${e.id}" class="btn small">Abrir →</a></td>
      </tr>`;
    })
    .join("");

  res.send(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Speed Dating · RelateReady Admin</title><style>${baseStyles()}</style></head>
<body>
  ${topbar()}
  <div class="container">
    <div class="page-head">
      <span class="eyebrow">Panel del organizador</span>
      <h1>Tus eventos de speed dating, <span class="accent-word">en vivo</span></h1>
      <p class="lede">Crea el evento, comparte el link de registro y controla las mesas y las rondas desde aquí — sin depender de nadie más el día del evento.</p>
    </div>
    ${renderCreateForm(values, error)}
    <div class="card">
      <h2 style="margin:0 0 14px;font-size:16px;">Eventos</h2>
      <table>
        <thead><tr><th>Evento</th><th>Estado</th><th>Asistentes</th><th>Creado</th><th></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:#999;padding:24px;">Todavía no hay ningún evento — créalo arriba.</td></tr>'}</tbody>
      </table>
    </div>
  </div>
</body></html>`);
}

router.get("/", (req, res) => {
  sendEventsListPage(res);
});

router.post("/", express.urlencoded({ extended: true }), (req, res) => {
  const name = (req.body.name || "").trim();
  const values = {
    name,
    event_date: (req.body.event_date || "").trim(),
    event_time: (req.body.event_time || "").trim(),
    capacity: req.body.capacity || 24,
    venue_name: (req.body.venue_name || "").trim(),
    venue_address: (req.body.venue_address || "").trim(),
    min_age: req.body.min_age || "",
    max_age: req.body.max_age || "",
    round_questions: (req.body.round_questions || "").replace(/\r\n/g, "\n"),
  };

  if (!name) {
    return sendEventsListPage(res, { values, error: "El nombre del evento es obligatorio." });
  }

  const capacity = Number(req.body.capacity) > 0 ? Number(req.body.capacity) : 24;
  const minAge = Number(req.body.min_age) > 0 ? Number(req.body.min_age) : null;
  const maxAge = Number(req.body.max_age) > 0 ? Number(req.body.max_age) : null;
  if (minAge && maxAge && minAge > maxAge) {
    return sendEventsListPage(res, { values, error: "La edad mínima no puede ser mayor que la edad máxima." });
  }

  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO sd_events (id, created_at, name, event_date, event_time, capacity, status, round_state, current_round_number, venue_name, venue_address, round_questions, min_age, max_age)
     VALUES (?, ?, ?, ?, ?, ?, 'registro', 'esperando_inicio', 0, ?, ?, ?, ?, ?)`
  ).run(
    id,
    new Date().toISOString(),
    name,
    (req.body.event_date || "").trim() || null,
    (req.body.event_time || "").trim() || null,
    capacity,
    (req.body.venue_name || "").trim() || null,
    (req.body.venue_address || "").trim() || null,
    (req.body.round_questions || "").replace(/\r\n/g, "\n").trim() || null,
    minAge,
    maxAge
  );
  res.redirect(`/admin/speed-dating/${id}`);
});

// ── Dashboard de un evento ───────────────────────────────────────────────
router.get("/:eventId", (req, res) => {
  const event = db.prepare("SELECT * FROM sd_events WHERE id = ?").get(req.params.eventId);
  if (!event) return res.status(404).send("Evento no encontrado.");

  const attendees = db
    .prepare("SELECT * FROM sd_attendees WHERE event_id = ? ORDER BY gender DESC, seat_index ASC")
    .all(event.id);
  // activeAttendees excluye a quienes cancelaron su participación (ver
  // services/speedDatingAttendees.js) — siguen apareciendo en la tabla de
  // abajo para que quede el registro, pero no cuentan para el aforo ni
  // para decidir si ya se puede iniciar el evento.
  const activeAttendees = attendees.filter((a) => !a.cancelled_at);
  const women = activeAttendees.filter((a) => a.gender === "F");
  const men = activeAttendees.filter((a) => a.gender === "M");

  // Quién falta por votar en la ronda actual — para que el organizador vea
  // ANTES de presionar "Cerrar ronda actual" si hay gente que todavía no ha
  // dado su voto Sí/No. Una vez cerrada la ronda, round_state pasa a
  // 'cambio_de_mesa' y el endpoint de voto (routes/speedDatingPublic.js)
  // deja de aceptar votos de esa ronda, así que a quien quedó pendiente ya
  // no se le vuelve a mostrar el botón para esa ronda — por eso esta lista
  // solo tiene sentido (y solo se calcula) mientras round_state sigue en
  // 'ronda_activa'.
  let pendingVoters = [];
  if (event.status === "en_curso" && event.round_state === "ronda_activa") {
    const currentPairings = db
      .prepare("SELECT * FROM sd_pairings WHERE event_id = ? AND round_number = ? AND man_id IS NOT NULL")
      .all(event.id, event.current_round_number);
    if (currentPairings.length) {
      const pairingIds = currentPairings.map((p) => p.id);
      const votedRows = db
        .prepare(`SELECT pairing_id, voter_attendee_id FROM sd_votes WHERE pairing_id IN (${pairingIds.map(() => "?").join(",")})`)
        .all(...pairingIds);
      const votedSet = new Set(votedRows.map((v) => `${v.pairing_id}:${v.voter_attendee_id}`));
      const attendeeById = new Map(attendees.map((a) => [a.id, a]));
      for (const p of currentPairings) {
        for (const attendeeId of [p.woman_id, p.man_id]) {
          const a = attendeeById.get(attendeeId);
          if (!a || a.cancelled_at) continue;
          if (!votedSet.has(`${p.id}:${attendeeId}`)) {
            pendingVoters.push({ name: a.name, gender: a.gender, mesa: p.table_number });
          }
        }
      }
      pendingVoters.sort((a, b) => a.mesa - b.mesa || a.name.localeCompare(b.name));
    }
  }

  // Lista de espera: gente que intentó registrarse cuando este evento ya
  // estaba lleno (routes/speedDatingPublic.js) — sus datos no se pierden,
  // se muestran aquí para invitarlos por WhatsApp al próximo evento.
  // openEvents alimenta el selector de "invitar a este evento" de esa
  // sección (cualquier otro evento que siga con registro abierto).
  // Votos de respaldo (tarjetas de papel) que todavía faltan por cargar —
  // se usa solo para la advertencia del botón "Enviar resultados ahora"
  // (ver más abajo): si faltan votos, enviar ya mismo puede dejar fuera
  // matches que todavía no se pueden calcular. Solo se calcula para
  // eventos finalizados, que es cuando ese botón aparece.
  let missingVotesCount = 0;
  if (event.status === "finalizado") {
    const finalPairings = db
      .prepare("SELECT id FROM sd_pairings WHERE event_id = ? AND man_id IS NOT NULL")
      .all(event.id);
    if (finalPairings.length) {
      const pairingIds = finalPairings.map((p) => p.id);
      const voteRows = db
        .prepare(`SELECT pairing_id, voter_attendee_id FROM sd_votes WHERE pairing_id IN (${pairingIds.map(() => "?").join(",")})`)
        .all(...pairingIds);
      const votedSet = new Set(voteRows.map((v) => `${v.pairing_id}:${v.voter_attendee_id}`));
      for (const p of db.prepare("SELECT * FROM sd_pairings WHERE event_id = ? AND man_id IS NOT NULL").all(event.id)) {
        if (!votedSet.has(`${p.id}:${p.woman_id}`)) missingVotesCount++;
        if (!votedSet.has(`${p.id}:${p.man_id}`)) missingVotesCount++;
      }
    }
  }

  // Cuántas personas recibirían el recordatorio de la encuesta (ver tarjeta
  // "Recordatorio de encuesta" más abajo).
  const surveyReminderPending = event.status === "finalizado" ? speedDatingSurveyScheduler.pendingSurveyReminderAttendees(event.id).length : 0;

  const waitlist = db.prepare("SELECT * FROM sd_waitlist WHERE event_id = ? ORDER BY created_at ASC").all(event.id);
  const openEvents = db
    .prepare("SELECT id, name, event_date, event_time FROM sd_events WHERE status = 'registro' AND id != ? ORDER BY created_at DESC")
    .all(event.id);

  // Mismo tope del 60% del aforo por género que aplica el registro público
  // (routes/speedDatingPublic.js, capacityState) — se muestra aquí solo
  // para que el organizador vea de un vistazo si algún género ya se cerró.
  const genderCap = Math.max(1, Math.floor(event.capacity * 0.6));

  const baseUrl = baseUrlOf(req);
  const registroUrl = `${baseUrl}/evento/${event.id}`;

  const attendeeRows = attendees
    .map((a) => {
      const mesa = a.cancelled_at ? "—" : (a.gender === "F" ? `Mesa fija ${a.table_number}` : `Posición de rotación ${a.seat_index + 1}`);
      const asistenteUrl = `${baseUrl}/speed-dating/asistente.html?token=${a.vote_token}`;
      const waDigits = waPhoneDigits(a.phone);
      const waUrl = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(buildWhatsappMessage({ attendee: a, event, asistenteUrl }))}` : null;
      const phoneLooksSuspicious = !!a.phone && !looksLikeValidEcuadorMobile(waDigits);
      const phoneWarning = phoneLooksSuspicious
        ? ` <span class="badge" style="background:${BRAND.clay};" title="Este número no tiene el formato esperado de un celular de Ecuador — revísalo antes de usarlo para WhatsApp.">⚠ revisar número</span>`
        : "";
      const cancelBadge = a.cancelled_at
        ? `<br><span class="badge" style="background:${BRAND.clay};margin-top:4px;">Canceló</span>${a.cancellation_reason ? ` <span class="muted">${esc(a.cancellation_reason)}</span>` : ""}`
        : "";
      return `<tr>
        <td>${esc(a.name)}<br><span class="muted">${esc(a.email) || "—"}${a.phone ? " · " + esc(a.phone) : ""}</span>${phoneWarning}${cancelBadge}</td>
        <td>${a.gender === "F" ? "Mujer" : "Hombre"}${a.age ? ", " + a.age + " años" : ""}</td>
        <td>${mesa}</td>
        <td>${a.share_phone_consent ? "Sí" : "No"}</td>
        <td>${a.match_email_status ? `<span class="badge" style="background:${a.match_email_status === "sent" ? BRAND.green : BRAND.clay}">${a.match_email_status}</span>` : '<span class="muted">—</span>'}
          ${event.status === "finalizado" ? `<form class="inline" method="POST" action="/admin/speed-dating/${event.id}/attendees/${a.id}/reenviar-correo"><button type="submit" class="btn small ghost" style="margin-top:4px;">Reenviar correo</button></form>` : ""}
        </td>
        <td>
          <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-start;">
            <button type="button" class="btn small ghost" onclick="navigator.clipboard.writeText('${asistenteUrl}').then(()=>{this.textContent='Copiado ✓';setTimeout(()=>this.textContent='Copiar link',1200);})">Copiar link</button>
            ${waUrl ? `<a href="${waUrl}" target="_blank" rel="noopener" class="btn small ghost">Enviar por WhatsApp</a>` : ""}
            <a href="/admin/speed-dating/${event.id}/attendees/${a.id}/editar" class="btn small ghost">Editar</a>
            ${event.status === "registro" ? `<form class="inline" method="POST" action="/admin/speed-dating/${event.id}/attendees/${a.id}/eliminar" onsubmit="return confirm('¿Eliminar a ${esc(a.name).replace(/'/g, "\\'")} de este evento? Esta acción no se puede deshacer.');"><button type="submit" class="btn small danger">Eliminar</button></form>` : ""}
          </div>
        </td>
      </tr>`;
    })
    .join("");

  const waitlistRows = waitlist
    .map((entry) => {
      const waDigits = waPhoneDigits(entry.phone);
      return `<tr>
        <td>${esc(entry.name)}<br><span class="muted">${esc(entry.email) || "—"}${entry.phone ? " · " + esc(entry.phone) : ""}</span></td>
        <td>${entry.gender === "F" ? "Mujer" : "Hombre"}${entry.age ? ", " + entry.age + " años" : ""}</td>
        <td>${entry.share_phone_consent ? "Sí" : "No"}</td>
        <td>${entry.created_at ? new Date(entry.created_at).toLocaleDateString("es-EC", { timeZone: "America/Guayaquil" }) : "—"}</td>
        <td>
          <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-start;">
            ${waDigits ? `<button type="button" class="btn small ghost wl-whatsapp-btn" data-wl-name="${esc(entry.name).replace(/"/g, "&quot;")}" data-wl-phone="${waDigits}">Enviar por WhatsApp</button>` : '<span class="muted">Sin teléfono válido</span>'}
            <form class="inline" method="POST" action="/admin/speed-dating/${event.id}/waitlist/${entry.id}/marcar-contactado">
              <button type="submit" class="btn small ${entry.contacted_at ? "" : "ghost"}">${entry.contacted_at ? "Contactado ✓" : "Marcar como contactado"}</button>
            </form>
          </div>
        </td>
      </tr>`;
    })
    .join("");

  const canIniciar = event.status === "registro" && activeAttendees.length > 0;
  const canCerrarRonda = event.status === "en_curso" && event.round_state === "ronda_activa";
  const canSiguienteRonda = event.status === "en_curso" && (event.round_state === "esperando_inicio" || event.round_state === "cambio_de_mesa");
  const canFinalizar = event.status === "en_curso";
  // Deshacer un "Cerrar ronda actual" presionado por error antes de que
  // todos hayan votado. Solo es seguro mientras seguimos en 'cambio_de_mesa'
  // para ESTA ronda (current_round_number no ha cambiado todavía) — en
  // cuanto se presiona "Iniciar ronda siguiente" el número de ronda avanza
  // y esa ventana de voto ya no se puede recuperar desde aquí.
  const canReabrirRonda = event.status === "en_curso" && event.round_state === "cambio_de_mesa";
  const isLastTransition = event.round_state === "cambio_de_mesa" && event.current_round_number >= (event.total_rounds || 0);
  const roundQuestionsList = parseRoundQuestions(event.round_questions);

  const eyebrowLabel = event.status === "en_curso" ? "Evento en vivo" : event.status === "finalizado" ? "Evento finalizado" : "Registro abierto";

  res.send(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(event.name)} · Speed Dating</title><style>${baseStyles()}</style></head>
<body>
  ${topbar()}
  <div class="container">
    <p><a href="/admin/speed-dating" class="muted" style="text-decoration:none;">← Todos los eventos</a></p>
    <div class="page-head">
      <span class="eyebrow">${eyebrowLabel}</span>
      <h1>${esc(event.name)}</h1>
      <p class="lede">${esc(event.event_date) || "Sin fecha"}${event.event_time ? ", " + esc(formatEventTimeEs(event.event_time)) : ""}${event.venue_name ? " · " + esc(event.venue_name) : ""}${event.venue_address ? " (" + esc(event.venue_address) + ")" : ""} · Aforo máximo ${event.capacity} asistentes${event.min_age || event.max_age ? " · " + (event.min_age && event.max_age ? `${event.min_age}–${event.max_age} años` : event.min_age ? `${event.min_age}+ años` : `hasta ${event.max_age} años`) : ""} · <span class="accent-word" style="font-weight:700;">${ROUND_STATE_LABEL[event.round_state] || STATUS_LABEL[event.status]}</span></p>
    </div>

    <div class="stats">
      <div class="stat-card"><div class="stat-num">${women.length}</div><div class="stat-label">Mujeres registradas${event.closed_women ? `<br><span class="badge" style="background:${BRAND.clay};margin-top:4px;">Cerrado manual</span>` : women.length >= genderCap ? `<br><span class="badge" style="background:${BRAND.clay};margin-top:4px;">Cerrado (60%)</span>` : ""}</div></div>
      <div class="stat-card"><div class="stat-num">${men.length}</div><div class="stat-label">Hombres registrados${event.closed_men ? `<br><span class="badge" style="background:${BRAND.clay};margin-top:4px;">Cerrado manual</span>` : men.length >= genderCap ? `<br><span class="badge" style="background:${BRAND.clay};margin-top:4px;">Cerrado (60%)</span>` : ""}</div></div>
      <div class="stat-card"><div class="stat-num">${event.total_rounds || "—"}</div><div class="stat-label">Rondas totales</div></div>
      <div class="stat-card"><div class="stat-num">${event.current_round_number}</div><div class="stat-label">Ronda actual</div></div>
    </div>

    <div class="card">
      <h2 style="margin:0 0 6px;font-size:15px;">Registro por género</h2>
      <p class="muted" style="margin:0 0 12px;font-size:13px;">Cierra el registro de un género en cualquier momento (sin tocar el aforo ni el otro género) — quien intente registrarse mientras está cerrado se guarda en la lista de espera, igual que cuando se llena el 60% automático.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <form method="POST" action="/admin/speed-dating/${event.id}/registro-genero">
          <input type="hidden" name="gender" value="M">
          <input type="hidden" name="closed" value="${event.closed_men ? "0" : "1"}">
          <button type="submit" class="btn ${event.closed_men ? "ghost" : ""}">${event.closed_men ? "Reabrir registro de hombres" : "Cerrar registro de hombres"}</button>
        </form>
        <form method="POST" action="/admin/speed-dating/${event.id}/registro-genero">
          <input type="hidden" name="gender" value="F">
          <input type="hidden" name="closed" value="${event.closed_women ? "0" : "1"}">
          <button type="submit" class="btn ${event.closed_women ? "ghost" : ""}">${event.closed_women ? "Reabrir registro de mujeres" : "Cerrar registro de mujeres"}</button>
        </form>
      </div>
      ${event.closed_men ? `<p class="muted" style="margin:10px 0 0;font-size:12.5px;">🔒 Registro de hombres cerrado manualmente.</p>` : ""}
      ${event.closed_women ? `<p class="muted" style="margin:10px 0 0;font-size:12.5px;">🔒 Registro de mujeres cerrado manualmente.</p>` : ""}
    </div>

    <div class="card">
      <details>
        <summary style="cursor:pointer;font-size:15px;font-weight:700;color:${BRAND.ink};">✎ Editar evento</summary>
        <form method="POST" action="/admin/speed-dating/${event.id}/editar" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-top:16px;">
          <div><label class="muted" style="display:block;margin-bottom:4px;">Nombre</label><input type="text" name="name" value="${esc(event.name)}" required></div>
          <div><label class="muted" style="display:block;margin-bottom:4px;">Fecha</label><input type="date" name="event_date" value="${esc(event.event_date || "")}"></div>
          <div><label class="muted" style="display:block;margin-bottom:4px;">Hora</label><input type="time" name="event_time" value="${esc(event.event_time || "")}" style="width:110px;"></div>
          <div><label class="muted" style="display:block;margin-bottom:4px;">Aforo máximo</label><input type="number" name="capacity" value="${event.capacity}" min="2" max="500" style="width:90px;"></div>
          <div><label class="muted" style="display:block;margin-bottom:4px;">Edad mínima</label><input type="number" name="min_age" value="${event.min_age || ""}" placeholder="25" min="18" max="99" style="width:80px;"></div>
          <div><label class="muted" style="display:block;margin-bottom:4px;">Edad máxima</label><input type="number" name="max_age" value="${event.max_age || ""}" placeholder="45" min="18" max="99" style="width:80px;"></div>
          <div><label class="muted" style="display:block;margin-bottom:4px;">Lugar</label><input type="text" name="venue_name" value="${esc(event.venue_name || "")}" placeholder="Ej. Mila Rooftop"></div>
          <div><label class="muted" style="display:block;margin-bottom:4px;">Dirección</label><input type="text" name="venue_address" value="${esc(event.venue_address || "")}" placeholder="Ciudad, dirección" style="min-width:220px;"></div>
          <div style="flex-basis:100%;">
            <label class="muted" style="display:block;margin-bottom:4px;">Preguntas de conversación por ronda (opcional)</label>
            <textarea name="round_questions" rows="4" style="width:100%;padding:9px 12px;border:1px solid ${BRAND.border};border-radius:8px;font-size:13px;font-family:inherit;" placeholder="Una pregunta por línea, en orden: la primera línea es la Ronda 1, la segunda la Ronda 2, etc.">${esc(event.round_questions || "")}</textarea>
          </div>
          <button type="submit" class="btn">Guardar cambios</button>
        </form>
        <p class="muted" style="margin:12px 0 0;">Puedes cambiar el aforo en cualquier momento, incluso justo antes de iniciar el evento — por ejemplo si el lugar confirma más o menos espacio del esperado.</p>
      </details>
    </div>

    <div class="card">
      <h2 style="margin:0 0 12px;font-size:15px;">Link de registro para compartir</h2>
      <p class="muted" style="margin:0;">Compártelo con los asistentes antes del evento (por WhatsApp, story, etc.). Cada quien se registra desde su propio celular.</p>
      <div class="link-box">${registroUrl}</div>
      <button type="button" class="btn small ghost" style="margin-top:8px;" onclick="navigator.clipboard.writeText('${registroUrl}').then(()=>{this.textContent='Copiado ✓';setTimeout(()=>this.textContent='Copiar link de registro',1200);})">Copiar link de registro</button>
    </div>

    <div class="card">
      <h2 style="margin:0 0 12px;font-size:15px;">Control del evento en vivo</h2>
      <p style="margin:0 0 14px;">Estado actual: <span class="round-state">${isLastTransition ? "Cambio de mesa → cierre del evento" : ROUND_STATE_LABEL[event.round_state]}</span></p>
      ${event.round_state === "ronda_activa" ? (pendingVoters.length
        ? `<div style="background:#FBEEE0;border:1px solid ${BRAND.clay};border-radius:10px;padding:12px 14px;margin:0 0 14px;">
             <p style="margin:0 0 6px;font-weight:700;font-size:13.5px;">⏳ Faltan por votar en esta ronda (${pendingVoters.length}):</p>
             <p style="margin:0;font-size:13px;line-height:1.6;">${pendingVoters.map((v) => `Mesa ${v.mesa} · ${esc(v.name)}`).join("<br>")}</p>
           </div>`
        : `<p style="margin:0 0 14px;color:${BRAND.green};font-size:13px;">✓ Todos los que tienen mesa esta ronda ya votaron.</p>`
      ) : ""}
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <form method="POST" action="/admin/speed-dating/${event.id}/iniciar">
          <button type="submit" class="btn" ${canIniciar ? "" : "disabled"}>Cerrar registro e iniciar evento</button>
        </form>
        <form method="POST" action="/admin/speed-dating/${event.id}/cerrar-ronda" id="form-cerrar-ronda">
          <button type="submit" class="btn" ${canCerrarRonda ? "" : "disabled"}>Cerrar ronda actual</button>
        </form>
        <form method="POST" action="/admin/speed-dating/${event.id}/reabrir-ronda" onsubmit="return confirm('¿Reabrir la ronda actual? Esto deshace el cierre y vuelve a mostrar los botones de Sí/No a quien todavía no haya votado en esta ronda. Úsalo solo si cerraste la ronda antes de tiempo.');">
          <button type="submit" class="btn ghost" ${canReabrirRonda ? "" : "disabled"}>↩ Reabrir ronda actual</button>
        </form>
        <form method="POST" action="/admin/speed-dating/${event.id}/siguiente-ronda">
          <button type="submit" class="btn" ${canSiguienteRonda ? "" : "disabled"}>${isLastTransition ? "Finalizar evento" : "Iniciar ronda siguiente"}</button>
        </form>
        <form method="POST" action="/admin/speed-dating/${event.id}/finalizar" onsubmit="return confirm('¿Finalizar el evento ahora? Esto calculará los matches y cerrará las rondas restantes.');">
          <button type="submit" class="btn danger" ${canFinalizar ? "" : "disabled"}>Finalizar evento ahora</button>
        </form>
      </div>
      ${event.status === "registro" ? '<p class="muted" style="margin-top:12px;">El registro sigue abierto — cuando todos hayan llegado, cierra el registro para calcular las mesas y las rondas.</p>' : ""}
    </div>
    <script>
      (function () {
        var PENDING_VOTERS = JSON.parse(${JSON.stringify(JSON.stringify([...pendingVoters])).replace(/</g, "\\u003c")});
        var f = document.getElementById("form-cerrar-ronda");
        if (f) {
          f.addEventListener("submit", function (e) {
            if (PENDING_VOTERS.length) {
              var lines = PENDING_VOTERS.map(function (v) { return "Mesa " + v.mesa + " \u00b7 " + v.name; }).join("\n");
              var msg = PENDING_VOTERS.length + " persona(s) todav\u00eda no han votado esta ronda:\n" + lines + "\n\n\u00bfCerrar la ronda de todos modos? Ya no van a poder votar en esta ronda (puedes reabrirla despu\u00e9s con \u00abReabrir ronda actual\u00bb si te equivocaste).";
              if (!confirm(msg)) e.preventDefault();
            }
          });
        }
      })();
    </script>

    ${roundQuestionsList.length ? `
    <div class="card">
      <h2 style="margin:0 0 6px;font-size:15px;">Preguntas de conversación por ronda</h2>
      <p class="muted" style="margin:0 0 14px;">La misma pregunta aparece en el celular de todas las mesas durante esa ronda.</p>
      <ol style="margin:0;padding-left:20px;">
        ${roundQuestionsList.map((q, i) => {
          const roundNum = i + 1;
          const isCurrent = event.status === "en_curso" && event.round_state === "ronda_activa" && event.current_round_number === roundNum;
          return `<li style="margin-bottom:8px;${isCurrent ? `font-weight:700;color:${BRAND.accentDark};` : ""}">${isCurrent ? `<span class="badge" style="background:${BRAND.green};margin-right:6px;">En vivo</span>` : ""}${esc(q)}</li>`;
        }).join("")}
      </ol>
    </div>` : ""}

    <div class="card">
      <h2 style="margin:0 0 12px;font-size:15px;">Informe de matching inmediato</h2>
      <p class="muted" style="margin:0 0 12px;">Disponible en cualquier momento, incluso a mitad del evento — no depende del correo automático de 48h.</p>
      <a href="/admin/speed-dating/${event.id}/reporte" class="btn ghost">Ver informe de matching →</a>
    </div>

    ${event.status === "finalizado" ? `
    <div class="card">
      <h2 style="margin:0 0 6px;font-size:15px;">Enviar resultados de matching ahora</h2>
      <p class="muted" style="margin:0 0 12px;">El correo de resultados (quién tuvo match) se envía automáticamente 48 horas después de finalizar el evento, para dar tiempo a cargar votos de respaldo en papel si hiciera falta. Este botón es para un caso puntual: envía el correo de inmediato a quien todavía no lo haya recibido, sin esperar las 48h — pensado para usarse evento por evento, no para cambiar el tiempo de espera de todos los eventos futuros.${missingVotesCount > 0 ? ` <strong style="color:${BRAND.clay};">Atención: todavía faltan ${missingVotesCount} voto(s) de respaldo por cargar en este evento — si envías ahora, esos votos no se van a contar en los matches de hoy.</strong>` : ""}</p>
      <form method="POST" action="/admin/speed-dating/${event.id}/enviar-resultados-ahora" onsubmit="return confirm(${JSON.stringify(
        (missingVotesCount > 0
          ? `Atención: todavía faltan ${missingVotesCount} voto(s) de respaldo por cargar — si envías ahora, esos votos no se van a contar.\n\n`
          : "") +
          "¿Enviar el correo de resultados (matches) ahora mismo a quien todavía no lo haya recibido, sin esperar las 48 horas? Esta acción no se puede deshacer."
      )});">
        <button type="submit" class="btn small danger">Enviar resultados ahora ⚠</button>
      </form>
    </div>` : ""}

    <div class="card">
      <h2 style="margin:0 0 6px;font-size:15px;">Completar votos de respaldo (tarjetas de papel)</h2>
      <p class="muted" style="margin:0 0 12px;">Si en alguna ronda se usaron las tarjetas físicas de Sí/No como respaldo (o algún voto del celular no alcanzó a registrarse), aquí puedes cargarlos manualmente. Solo se piden los votos que todavía faltan — los que ya están registrados desde el celular no se tocan — y al guardar se recalculan automáticamente los matches, incluyendo los que falten por el correo de 48h.</p>
      <a href="/admin/speed-dating/${event.id}/completar-votos" class="btn ghost">Completar votos faltantes →</a>
    </div>

    <div class="card">
      <h2 style="margin:0 0 6px;font-size:15px;">Encuesta de satisfacción</h2>
      <p class="muted" style="margin:0 0 12px;">Se envía automáticamente por correo la mañana siguiente al evento, antes del mediodía (hora de Ecuador) — evalúa registro, rondas, lugar y organización, más una recomendación. No pregunta por matches (esos salen 48h después).</p>
      <a href="/admin/speed-dating/${event.id}/encuesta-resultados" class="btn ghost">Ver resultados de la encuesta →</a>
    </div>

    ${event.status === "finalizado" ? `
    <div class="card">
      <h2 style="margin:0 0 6px;font-size:15px;">Recordatorio de encuesta</h2>
      <p class="muted" style="margin:0 0 12px;">Envía un segundo correo a quien asistió y todavía no contestó la encuesta, pidiéndole que la complete y recordándole que el código VIP del Informe Extendido vence en 3 días (quien ya tiene su informe completo no ve ese recuadro). Si alguien ya recibió este recordatorio, no se le vuelve a enviar. Personas que lo recibirían ahora: <strong>${surveyReminderPending}</strong>.</p>
      <form method="POST" action="/admin/speed-dating/${event.id}/enviar-recordatorio-encuesta" onsubmit="return confirm('¿Enviar el recordatorio de la encuesta a ${surveyReminderPending} persona(s) que todavía no la han contestado? Esta acción no se puede deshacer.');">
        <button type="submit" class="btn small" ${surveyReminderPending === 0 ? "disabled" : ""}>Enviar recordatorio de encuesta</button>
      </form>
    </div>` : ""}

    <div class="card">
      <h2 style="margin:0 0 6px;font-size:15px;">Reenviar recordatorio de 1 día antes</h2>
      <p class="muted" style="margin:0 0 12px;">Botón de emergencia: vuelve a enviar el recordatorio de 1 día antes a todos los asistentes activos con correo, con una nota de disculpa aclarando la fecha real del evento. Úsalo solo si el automático salió a la hora o el día equivocado.</p>
      <form method="POST" action="/admin/speed-dating/${event.id}/reenviar-recordatorio-1d" onsubmit="return confirm('¿Reenviar el recordatorio de 1 día (con nota de disculpa) a todos los asistentes activos de este evento?');">
        <button type="submit" class="btn small ghost">Reenviar recordatorio de 1 día (corregido) ⚠</button>
      </form>
    </div>

    <div class="card">
      <h2 style="margin:0 0 6px;font-size:15px;">Enviar recordatorio del mismo día</h2>
      <p class="muted" style="margin:0 0 12px;">Manda ahora mismo un recordatorio extra a todos los asistentes activos con correo que todavía no lo hayan recibido — mismos datos del evento (fecha, lugar, mesa, celular cargado), sin la nota de disculpa, y con un aviso para que tengan el correo a la mano y entren con el botón apenas empiece el evento. Úsalo el mismo día, unas horas antes.</p>
      <form method="POST" action="/admin/speed-dating/${event.id}/recordatorio-mismo-dia" onsubmit="return confirm('¿Enviar el recordatorio del mismo día a todos los asistentes activos de este evento?');">
        <button type="submit" class="btn small">Enviar recordatorio del mismo día</button>
      </form>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
        <h2 style="margin:0;font-size:15px;">Asistentes (${activeAttendees.length}${attendees.length !== activeAttendees.length ? ` · ${attendees.length - activeAttendees.length} canceló su cupo` : ""})</h2>
        <a href="/admin/speed-dating/${event.id}/exportar" class="btn small ghost">Exportar a Excel ⬇</a>
      </div>
      <table>
        <thead><tr><th>Persona</th><th>Género</th><th>Mesa</th><th>Autorizó WhatsApp</th><th>Correo de resultados</th><th></th></tr></thead>
        <tbody>${attendeeRows || '<tr><td colspan="6" style="text-align:center;color:#999;padding:24px;">Todavía no hay nadie registrado.</td></tr>'}</tbody>
      </table>
    </div>

    <div class="card">
      <h2 style="margin:0 0 6px;font-size:15px;">Lista de espera (${waitlist.length})</h2>
      <p class="muted" style="margin:0 0 14px;">Se llena sola: cuando alguien intenta registrarse y este evento ya no tiene cupo, sus datos quedan guardados aquí en vez de perderse — invítalos por WhatsApp al próximo evento apenas tengas fecha.</p>
      ${waitlist.length ? `
      <div style="margin-bottom:14px;">
        <label class="muted" style="display:block;margin-bottom:4px;">Invitar al evento (opcional — arma el link del mensaje):</label>
        <select id="wl-target-event" style="padding:8px 10px;border:1px solid ${BRAND.border};border-radius:8px;font-size:13px;">
          <option value="">— Sin link todavía, solo avisar —</option>
          ${openEvents.map((oe) => `<option value="${oe.id}">${esc(oe.name)}${oe.event_date ? " · " + esc(oe.event_date) : ""}${oe.event_time ? ", " + esc(formatEventTimeEs(oe.event_time)) : ""}</option>`).join("")}
        </select>
      </div>
      <table>
        <thead><tr><th>Persona</th><th>Género</th><th>Autorizó WhatsApp</th><th>Se registró</th><th></th></tr></thead>
        <tbody>${waitlistRows}</tbody>
      </table>
      ` : '<p class="muted" style="margin:0;">Todavía nadie ha quedado en lista de espera para este evento.</p>'}
    </div>
  </div>

  <script>
    document.querySelectorAll('.wl-whatsapp-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var name = btn.dataset.wlName;
        var phone = btn.dataset.wlPhone;
        if (!phone) { alert('Esta persona no dejó un teléfono válido.'); return; }
        var select = document.getElementById('wl-target-event');
        var targetId = select ? select.value : '';
        var targetLabel = select && select.selectedOptions[0] ? select.selectedOptions[0].textContent : '';
        var firstName = (name || '').trim().split(/\s+/)[0] || name;
        var lines = ['Hola ' + firstName + ' 👋 Soy del equipo de RelateReady.', '', 'El evento al que querías ir se llenó, ¡pero ya tenemos el próximo!'];
        if (targetId) {
          lines.push('Aquí está tu link para registrarte a *' + targetLabel + '*:', location.origin + '/evento/' + targetId);
        } else {
          lines.push('Apenas tengamos fecha confirmada para el próximo evento te compartimos aquí mismo el link para que te registres.');
        }
        lines.push('', '¡Te esperamos! 💛');
        var url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(lines.join('\n'));
        window.open(url, '_blank', 'noopener');
      });
    });
  </script>
</body></html>`);
});

// ── Editar evento: nombre, fecha, aforo y lugar. Disponible en cualquier
// momento (registro abierto, evento en curso, incluso ya finalizado) —
// en particular el aforo puede necesitar ajustarse a último momento, justo
// antes de iniciar el evento, tras varios días de promoción. ────────────
router.post("/:eventId/editar", express.urlencoded({ extended: true }), (req, res) => {
  const event = db.prepare("SELECT * FROM sd_events WHERE id = ?").get(req.params.eventId);
  if (!event) return res.status(404).send("Evento no encontrado.");

  const name = (req.body.name || "").trim() || event.name;
  const eventDate = (req.body.event_date || "").trim() || null;
  const eventTime = (req.body.event_time || "").trim() || null;
  const capacity = Number(req.body.capacity) > 0 ? Number(req.body.capacity) : event.capacity;
  const venueName = (req.body.venue_name || "").trim() || null;
  const venueAddress = (req.body.venue_address || "").trim() || null;
  const roundQuestions = (req.body.round_questions || "").replace(/\r\n/g, "\n").trim() || null;
  let minAge = Number(req.body.min_age) > 0 ? Number(req.body.min_age) : null;
  let maxAge = Number(req.body.max_age) > 0 ? Number(req.body.max_age) : null;
  if (minAge && maxAge && minAge > maxAge) {
    // Edad mínima mayor que la máxima: no tiene sentido — se ignora el
    // cambio de edad y se conserva lo que el evento ya tenía guardado.
    minAge = event.min_age;
    maxAge = event.max_age;
  }

  db.prepare(
    `UPDATE sd_events SET name = ?, event_date = ?, event_time = ?, capacity = ?, venue_name = ?, venue_address = ?, round_questions = ?, min_age = ?, max_age = ? WHERE id = ?`
  ).run(name, eventDate, eventTime, capacity, venueName, venueAddress, roundQuestions, minAge, maxAge, event.id);

  res.redirect(`/admin/speed-dating/${event.id}`);
});

// POST /:eventId/registro-genero — cierra o reabre el registro público de
// un solo género (ver migración closed_men/closed_women en db/init.js y
// capacityState en routes/speedDatingPublic.js). No toca el aforo ni el
// otro género: mientras está cerrado, quien intente registrarse de ese
// género se guarda en la lista de espera en vez de ocupar un cupo.
router.post("/:eventId/registro-genero", express.urlencoded({ extended: true }), (req, res) => {
  const event = db.prepare("SELECT * FROM sd_events WHERE id = ?").get(req.params.eventId);
  if (!event) return res.status(404).send("Evento no encontrado.");

  const gender = req.body.gender === "F" ? "F" : req.body.gender === "M" ? "M" : null;
  const closed = req.body.closed === "1" ? 1 : 0;
  if (gender === "M") {
    db.prepare("UPDATE sd_events SET closed_men = ? WHERE id = ?").run(closed, event.id);
  } else if (gender === "F") {
    db.prepare("UPDATE sd_events SET closed_women = ? WHERE id = ?").run(closed, event.id);
  }

  res.redirect(`/admin/speed-dating/${event.id}`);
});

// ── Editar asistente: corrige datos de contacto, edad o género de un
// registro puntual (por ejemplo, uno de prueba, o un dato mal escrito). El
// género solo se puede cambiar mientras el evento sigue en "registro" —
// una vez iniciado, las mesas ya están asignadas en sd_pairings. ────────
router.get("/:eventId/attendees/:attendeeId/editar", (req, res) => {
  const event = db.prepare("SELECT * FROM sd_events WHERE id = ?").get(req.params.eventId);
  if (!event) return res.status(404).send("Evento no encontrado.");
  const attendee = db.prepare("SELECT * FROM sd_attendees WHERE id = ? AND event_id = ?").get(req.params.attendeeId, event.id);
  if (!attendee) return res.status(404).send("Asistente no encontrado.");

  res.send(
    renderAttendeeEditPage({
      event,
      attendee,
      values: {
        name: attendee.name,
        email: attendee.email,
        phone: attendee.phone,
        age: attendee.age,
        gender: attendee.gender,
        share_phone_consent: attendee.share_phone_consent,
      },
      error: null,
    })
  );
});

router.post("/:eventId/attendees/:attendeeId/editar", express.urlencoded({ extended: true }), (req, res) => {
  const event = db.prepare("SELECT * FROM sd_events WHERE id = ?").get(req.params.eventId);
  if (!event) return res.status(404).send("Evento no encontrado.");
  const attendee = db.prepare("SELECT * FROM sd_attendees WHERE id = ? AND event_id = ?").get(req.params.attendeeId, event.id);
  if (!attendee) return res.status(404).send("Asistente no encontrado.");

  const canChangeGender = event.status === "registro";
  const values = {
    name: (req.body.name || "").trim(),
    email: (req.body.email || "").trim(),
    phone: (req.body.phone || "").trim(),
    age: req.body.age,
    gender: canChangeGender ? req.body.gender : attendee.gender,
    share_phone_consent: req.body.share_phone_consent ? 1 : 0,
  };

  const rerender = (error) => res.send(renderAttendeeEditPage({ event, attendee, values, error }));

  if (!values.name) return rerender("El nombre es obligatorio.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) return rerender("El correo no es válido.");
  if (!values.phone) return rerender("El teléfono/WhatsApp es obligatorio.");
  if (values.gender !== "M" && values.gender !== "F") return rerender("Selecciona un género válido.");

  const age = Number(values.age);
  if (!Number.isInteger(age) || age < 1 || age > 120) return rerender("La edad debe ser un número válido.");
  if ((event.min_age && age < event.min_age) || (event.max_age && age > event.max_age)) {
    const rangeLabel =
      event.min_age && event.max_age
        ? `de ${event.min_age} a ${event.max_age} años`
        : event.min_age
        ? `de ${event.min_age} años en adelante`
        : `hasta ${event.max_age} años`;
    return rerender(`Este evento es para personas ${rangeLabel}.`);
  }

  const previousGender = attendee.gender;
  const genderChanged = values.gender !== previousGender;

  db.prepare(
    `UPDATE sd_attendees SET name = ?, email = ?, phone = ?, age = ?, gender = ?, share_phone_consent = ? WHERE id = ?`
  ).run(values.name, values.email, values.phone, age, values.gender, values.share_phone_consent, attendee.id);

  if (genderChanged) {
    // Cambia de grupo: hay que recalcular la mesa/posición de ambos géneros
    // para que no quede ni un hueco ni un número repetido.
    renumberGender(event.id, previousGender);
    renumberGender(event.id, values.gender);
  }

  res.redirect(`/admin/speed-dating/${event.id}`);
});

// ── Eliminar asistente: solo mientras el evento sigue en "registro" — una
// vez que se generó el calendario de rondas (sd_pairings ya referencia a
// cada asistente), borrarlo rompería las rondas armadas y el informe de
// matching, así que la solicitud simplemente se ignora en ese caso. ─────
router.post("/:eventId/attendees/:attendeeId/eliminar", (req, res) => {
  const event = db.prepare("SELECT * FROM sd_events WHERE id = ?").get(req.params.eventId);
  if (!event) return res.status(404).send("Evento no encontrado.");
  if (event.status !== "registro") {
    return res.redirect(`/admin/speed-dating/${event.id}`);
  }
  const attendee = db.prepare("SELECT * FROM sd_attendees WHERE id = ? AND event_id = ?").get(req.params.attendeeId, event.id);
  if (!attendee) return res.status(404).send("Asistente no encontrado.");

  db.prepare("DELETE FROM sd_attendees WHERE id = ?").run(attendee.id);
  renumberGender(event.id, attendee.gender);

  res.redirect(`/admin/speed-dating/${event.id}`);
});

// ── Marcar/desmarcar a alguien de la lista de espera como ya contactado —
// simple ida y vuelta (toggle) para que el organizador lleve registro de a
// quién ya le avisó del próximo evento, sin duplicar mensajes. Disponible
// en cualquier momento, sin depender del estado del evento.
router.post("/:eventId/waitlist/:waitlistId/marcar-contactado", (req, res) => {
  const event = db.prepare("SELECT * FROM sd_events WHERE id = ?").get(req.params.eventId);
  if (!event) return res.status(404).send("Evento no encontrado.");
  const entry = db.prepare("SELECT * FROM sd_waitlist WHERE id = ? AND event_id = ?").get(req.params.waitlistId, event.id);
  if (!entry) return res.status(404).send("Registro de lista de espera no encontrado.");

  db.prepare("UPDATE sd_waitlist SET contacted_at = ? WHERE id = ?").run(
    entry.contacted_at ? null : new Date().toISOString(),
    entry.id
  );

  res.redirect(`/admin/speed-dating/${event.id}`);
});

// ── Iniciar evento: cierra registro y genera el calendario de rondas ────
router.post("/:eventId/iniciar", (req, res) => {
  const event = db.prepare("SELECT * FROM sd_events WHERE id = ?").get(req.params.eventId);
  if (!event || event.status !== "registro") return res.redirect(`/admin/speed-dating/${req.params.eventId}`);

  const attendees = db
    .prepare("SELECT * FROM sd_attendees WHERE event_id = ? AND cancelled_at IS NULL ORDER BY seat_index ASC")
    .all(event.id);
  const women = attendees.filter((a) => a.gender === "F");
  const men = attendees.filter((a) => a.gender === "M");

  if (!women.length && !men.length) return res.redirect(`/admin/speed-dating/${event.id}`);

  const { totalRounds, pairings } = generateSchedule(women, men);

  const insert = db.prepare(
    `INSERT INTO sd_pairings (id, event_id, round_number, table_number, woman_id, man_id) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const tx = db.transaction((rows) => {
    for (const p of rows) {
      insert.run(crypto.randomUUID(), event.id, p.round, p.table, p.womanId, p.manId);
    }
    db.prepare(
      `UPDATE sd_events SET status = 'en_curso', round_state = 'esperando_inicio', current_round_number = 0, total_rounds = ? WHERE id = ?`
    ).run(totalRounds, event.id);
  });
  tx(pairings);

  res.redirect(`/admin/speed-dating/${event.id}`);
});

router.post("/:eventId/cerrar-ronda", (req, res) => {
  db.prepare(
    `UPDATE sd_events SET round_state = 'cambio_de_mesa' WHERE id = ? AND status = 'en_curso' AND round_state = 'ronda_activa'`
  ).run(req.params.eventId);
  res.redirect(`/admin/speed-dating/${req.params.eventId}`);
});

// Deshace un "Cerrar ronda actual" presionado por error. Solo funciona
// mientras current_round_number no ha avanzado todavía (round_state sigue
// en 'cambio_de_mesa' para esta misma ronda) — no borra ni toca sd_pairings
// ni sd_votes, así que los votos ya emitidos se conservan intactos.
router.post("/:eventId/reabrir-ronda", (req, res) => {
  db.prepare(
    `UPDATE sd_events SET round_state = 'ronda_activa' WHERE id = ? AND status = 'en_curso' AND round_state = 'cambio_de_mesa'`
  ).run(req.params.eventId);
  res.redirect(`/admin/speed-dating/${req.params.eventId}`);
});

router.post("/:eventId/siguiente-ronda", (req, res) => {
  const event = db.prepare("SELECT * FROM sd_events WHERE id = ?").get(req.params.eventId);
  if (!event || event.status !== "en_curso") return res.redirect(`/admin/speed-dating/${req.params.eventId}`);
  if (event.round_state !== "esperando_inicio" && event.round_state !== "cambio_de_mesa") {
    return res.redirect(`/admin/speed-dating/${event.id}`);
  }

  if (event.round_state === "cambio_de_mesa" && event.current_round_number >= (event.total_rounds || 0)) {
    finalizeEvent(event.id);
  } else {
    db.prepare(`UPDATE sd_events SET round_state = 'ronda_activa', current_round_number = current_round_number + 1 WHERE id = ?`).run(event.id);
  }
  res.redirect(`/admin/speed-dating/${event.id}`);
});

function finalizeEvent(eventId) {
  persistMatches(eventId);
  db.prepare(
    `UPDATE sd_events SET status = 'finalizado', round_state = 'finalizado', finalized_at = ? WHERE id = ?`
  ).run(new Date().toISOString(), eventId);
}

router.post("/:eventId/finalizar", (req, res) => {
  const event = db.prepare("SELECT * FROM sd_events WHERE id = ?").get(req.params.eventId);
  if (event && event.status === "en_curso") finalizeEvent(event.id);
  res.redirect(`/admin/speed-dating/${req.params.eventId}`);
});

// ── Completar votos de respaldo (tarjetas de papel) ─────────────────────
// Para cuando en alguna ronda se usaron las tarjetas físicas de Sí/No en
// vez del celular (por ejemplo, como respaldo tras cerrar una ronda antes
// de tiempo), o algún voto del celular nunca llegó a registrarse. Muestra,
// ronda por ronda, SOLO las mesas con algún voto faltante (los ya
// registrados desde el celular se muestran como texto, no como campo
// editable, para no arriesgarse a sobrescribirlos sin querer). Al guardar,
// inserta los votos directamente en sd_votes (mismo patrón que el voto
// público de routes/speedDatingPublic.js) y vuelve a calcular los matches
// mutuos con persistMatches — que es seguro de llamar varias veces, nunca
// borra ni duplica un match ya guardado (UNIQUE + INSERT OR IGNORE), así
// que si el evento ya está finalizado esto puede rescatar matches que se
// hubieran perdido antes de que salga el correo automático de 48h
// (services/speedDatingScheduler.js, que lee de sd_matches).
router.get("/:eventId/completar-votos", (req, res) => {
  const event = db.prepare("SELECT * FROM sd_events WHERE id = ?").get(req.params.eventId);
  if (!event) return res.status(404).send("Evento no encontrado.");

  const pairings = db
    .prepare("SELECT * FROM sd_pairings WHERE event_id = ? AND man_id IS NOT NULL ORDER BY round_number ASC, table_number ASC")
    .all(event.id);
  const attendeeById = new Map(
    db.prepare("SELECT * FROM sd_attendees WHERE event_id = ?").all(event.id).map((a) => [a.id, a])
  );
  const voteRows = db
    .prepare(
      `SELECT pairing_id, voter_attendee_id, vote FROM sd_votes
       WHERE pairing_id IN (SELECT id FROM sd_pairings WHERE event_id = ?)`
    )
    .all(event.id);
  const voteMap = new Map(voteRows.map((v) => [`${v.pairing_id}:${v.voter_attendee_id}`, v.vote]));

  const byRound = new Map();
  let missingTotal = 0;
  for (const p of pairings) {
    const woman = attendeeById.get(p.woman_id);
    const man = attendeeById.get(p.man_id);
    if (!woman || !man) continue;
    const womanVote = voteMap.get(`${p.id}:${p.woman_id}`) || null;
    const manVote = voteMap.get(`${p.id}:${p.man_id}`) || null;
    if (!womanVote) missingTotal++;
    if (!manVote) missingTotal++;
    if (womanVote && manVote) continue; // esta mesa ya está completa — no hace falta mostrarla
    if (!byRound.has(p.round_number)) byRound.set(p.round_number, []);
    byRound.get(p.round_number).push({ pairing: p, woman, man, womanVote, manVote });
  }

  const voteCell = (pairingId, attendeeId, existingVote, label) => {
    if (existingVote) {
      const niceVote = existingVote === "si" ? "Sí" : "No";
      return `<strong>${esc(label)}</strong><br><span class="muted">Ya registrado: ${niceVote}</span>`;
    }
    const field = `vote_${pairingId}_${attendeeId}`;
    return `<strong>${esc(label)}</strong><br>
      <label style="margin-right:10px;"><input type="radio" name="${field}" value="si"> Sí</label>
      <label style="margin-right:10px;"><input type="radio" name="${field}" value="no"> No</label>
      <label><input type="radio" name="${field}" value="" checked> — sin dato —</label>`;
  };

  const roundNumbers = [...byRound.keys()].sort((a, b) => a - b);
  const roundsHtml = roundNumbers
    .map((roundNum) => {
      const rows = byRound
        .get(roundNum)
        .map(
          ({ pairing, woman, man, womanVote, manVote }) => `<tr>
            <td>Mesa ${pairing.table_number}</td>
            <td>${voteCell(pairing.id, woman.id, womanVote, woman.name)}</td>
            <td>${voteCell(pairing.id, man.id, manVote, man.name)}</td>
          </tr>`
        )
        .join("");
      return `<div class="card">
        <h2 style="margin:0 0 12px;font-size:15px;">Ronda ${roundNum}</h2>
        <table>
          <thead><tr><th>Mesa</th><th>Mujer</th><th>Hombre</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    })
    .join("");

  const guardado = req.query.guardado !== undefined ? parseInt(req.query.guardado, 10) || 0 : null;
  const nuevos = req.query.nuevos !== undefined ? parseInt(req.query.nuevos, 10) || 0 : null;

  res.send(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Completar votos · ${esc(event.name)}</title><style>${baseStyles()}</style></head>
<body>
  ${topbar()}
  <div class="container">
    <p><a href="/admin/speed-dating/${event.id}" class="muted" style="text-decoration:none;">← Volver al evento</a></p>
    <div class="page-head">
      <span class="eyebrow">Votos de respaldo</span>
      <h1>${esc(event.name)} — <span class="accent-word">completar votos faltantes</span></h1>
      <p class="lede">Usa esto para cargar los votos de las tarjetas físicas, o cualquier voto del celular que no haya llegado a registrarse. Solo se muestran las mesas con algo pendiente — las que ya tienen los dos votos no aparecen aquí.</p>
    </div>
    ${guardado !== null ? `<div class="card" style="background:${BRAND.green}22;border:1px solid ${BRAND.green};">
      <p style="margin:0;">✓ Se guardaron ${guardado} voto(s) nuevo(s)${nuevos ? ` — se encontraron ${nuevos} match(es) mutuo(s) nuevo(s) gracias a estos votos` : ""}.</p>
    </div>` : ""}
    <div class="card">
      <p style="margin:0;">Votos pendientes en total: <strong>${missingTotal}</strong>${missingTotal === 0 ? " — ya no falta nada 🎉" : ""}</p>
    </div>
    ${missingTotal > 0 ? `<form method="POST" action="/admin/speed-dating/${event.id}/completar-votos">
      ${roundsHtml}
      <button type="submit" class="btn" style="margin-top:4px;">Guardar votos</button>
    </form>` : ""}
  </div>
</body></html>`);
});

router.post("/:eventId/completar-votos", express.urlencoded({ extended: true }), (req, res) => {
  const event = db.prepare("SELECT * FROM sd_events WHERE id = ?").get(req.params.eventId);
  if (!event) return res.status(404).send("Evento no encontrado.");

  const pairingIds = new Set(
    db.prepare("SELECT id FROM sd_pairings WHERE event_id = ?").all(event.id).map((r) => r.id)
  );
  const attendeeIds = new Set(
    db.prepare("SELECT id FROM sd_attendees WHERE event_id = ?").all(event.id).map((r) => r.id)
  );

  const insertVote = db.prepare(
    `INSERT INTO sd_votes (id, pairing_id, voter_attendee_id, vote, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(pairing_id, voter_attendee_id) DO UPDATE SET vote = excluded.vote`
  );

  let savedCount = 0;
  const now = new Date().toISOString();
  for (const [key, rawValue] of Object.entries(req.body || {})) {
    const match = /^vote_([0-9a-fA-F-]{36})_([0-9a-fA-F-]{36})$/.exec(key);
    if (!match) continue;
    const [, pairingId, attendeeId] = match;
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    if (value !== "si" && value !== "no") continue;
    if (!pairingIds.has(pairingId) || !attendeeIds.has(attendeeId)) continue; // seguridad: solo datos de este evento
    insertVote.run(crypto.randomUUID(), pairingId, attendeeId, value, now);
    savedCount++;
  }

  const beforeCount = db.prepare("SELECT COUNT(*) AS c FROM sd_matches WHERE event_id = ?").get(event.id).c;
  persistMatches(event.id);
  const afterCount = db.prepare("SELECT COUNT(*) AS c FROM sd_matches WHERE event_id = ?").get(event.id).c;

  res.redirect(`/admin/speed-dating/${event.id}/completar-votos?guardado=${savedCount}&nuevos=${afterCount - beforeCount}`);
});

// ── Informe de matching inmediato (disponible en cualquier momento) ─────
router.get("/:eventId/reporte", (req, res) => {
  const event = db.prepare("SELECT * FROM sd_events WHERE id = ?").get(req.params.eventId);
  if (!event) return res.status(404).send("Evento no encontrado.");

  const matches = computeMutualMatches(event.id);
  const rows = matches
    .map(
      (m) => `<tr>
        <td>${esc(m.woman_name)}</td>
        <td>${esc(m.man_name)}</td>
        <td>Mesa ${m.table_number}</td>
        <td>Ronda ${m.round_number}</td>
      </tr>`
    )
    .join("");

  res.send(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Informe de matching · ${esc(event.name)}</title><style>${baseStyles()}</style></head>
<body>
  ${topbar()}
  <div class="container">
    <p><a href="/admin/speed-dating/${event.id}" class="muted" style="text-decoration:none;">← Volver al evento</a></p>
    <div class="page-head">
      <span class="eyebrow">Informe de matching</span>
      <h1>${esc(event.name)} — <span class="accent-word">matches en vivo</span></h1>
      <p class="lede">Se actualiza con los votos registrados hasta ahora. No depende del correo automático de 48h — puedes consultarlo en cualquier momento del evento.</p>
    </div>
    <div class="card">
      <h2 style="margin:0 0 14px;font-size:15px;">Matches mutuos (${matches.length})</h2>
      <table>
        <thead><tr><th>Mujer</th><th>Hombre</th><th>Mesa</th><th>Ronda</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:#999;padding:24px;">Todavía no hay ningún match mutuo registrado.</td></tr>'}</tbody>
      </table>
    </div>
  </div>
</body></html>`);
});

// ── Exportar asistentes a Excel (disponible en cualquier momento, antes y
// después del evento — no depende del estado). Incluye a todos los
// asistentes, también a quienes cancelaron su cupo (services/
// speedDatingAttendees.js), con su motivo, para que quede como respaldo
// completo del evento. ───────────────────────────────────────────────────
router.get("/:eventId/exportar", async (req, res) => {
  const event = db.prepare("SELECT * FROM sd_events WHERE id = ?").get(req.params.eventId);
  if (!event) return res.status(404).send("Evento no encontrado.");

  const attendees = db
    .prepare("SELECT * FROM sd_attendees WHERE event_id = ? ORDER BY gender DESC, seat_index ASC")
    .all(event.id);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RelateReady";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Asistentes");
  sheet.columns = [
    { header: "Nombre", key: "name", width: 28 },
    { header: "Correo", key: "email", width: 30 },
    { header: "Teléfono/WhatsApp", key: "phone", width: 18 },
    { header: "Género", key: "gender", width: 10 },
    { header: "Edad", key: "age", width: 8 },
    { header: "Mesa", key: "mesa", width: 24 },
    { header: "Autorizó compartir WhatsApp", key: "consent", width: 16 },
    { header: "Estado", key: "estado", width: 14 },
    { header: "Motivo de cancelación", key: "motivo", width: 32 },
    { header: "Correo de resultados", key: "match_email_status", width: 16 },
    { header: "Fecha de registro", key: "created_at", width: 20 },
  ];
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB5732A" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  attendees.forEach((a) => {
    const mesa = a.cancelled_at
      ? "—"
      : a.gender === "F"
      ? `Mesa fija ${a.table_number ?? "—"}`
      : `Posición de rotación ${a.seat_index != null ? a.seat_index + 1 : "—"}`;
    sheet.addRow({
      name: a.name,
      email: a.email || "",
      phone: a.phone || "",
      gender: a.gender === "F" ? "Mujer" : "Hombre",
      age: a.age != null ? a.age : "",
      mesa,
      consent: a.share_phone_consent ? "Sí" : "No",
      estado: a.cancelled_at ? "Canceló" : "Activo",
      motivo: a.cancellation_reason || "",
      match_email_status: a.match_email_status || "",
      created_at: a.created_at ? new Date(a.created_at).toLocaleString("es-EC", { timeZone: "America/Guayaquil" }) : "",
    });
  });

  // Segunda hoja con la lista de espera de este evento (si tiene alguna) —
  // mismo criterio de "exportable en cualquier momento" que la de
  // asistentes, para que el organizador tenga todo en un solo archivo.
  const waitlistEntries = db
    .prepare("SELECT * FROM sd_waitlist WHERE event_id = ? ORDER BY created_at ASC")
    .all(event.id);

  if (waitlistEntries.length) {
    const wlSheet = workbook.addWorksheet("Lista de espera");
    wlSheet.columns = [
      { header: "Nombre", key: "name", width: 28 },
      { header: "Correo", key: "email", width: 30 },
      { header: "Teléfono/WhatsApp", key: "phone", width: 18 },
      { header: "Género", key: "gender", width: 10 },
      { header: "Edad", key: "age", width: 8 },
      { header: "Autorizó compartir WhatsApp", key: "consent", width: 16 },
      { header: "Contactado", key: "contacted", width: 14 },
      { header: "Fecha", key: "created_at", width: 20 },
    ];
    wlSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    wlSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB5732A" } };
    wlSheet.views = [{ state: "frozen", ySplit: 1 }];

    waitlistEntries.forEach((entry) => {
      wlSheet.addRow({
        name: entry.name,
        email: entry.email || "",
        phone: entry.phone || "",
        gender: entry.gender === "F" ? "Mujer" : "Hombre",
        age: entry.age != null ? entry.age : "",
        consent: entry.share_phone_consent ? "Sí" : "No",
        contacted: entry.contacted_at ? "Sí" : "No",
        created_at: entry.created_at ? new Date(entry.created_at).toLocaleString("es-EC", { timeZone: "America/Guayaquil" }) : "",
      });
    });
  }

  const safeName = (event.name || "evento").replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  const filename = `asistentes_${safeName}.xlsx`;

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
});

// ── Reenvío manual del correo de resultados a un asistente ──────────────
router.post("/:eventId/attendees/:attendeeId/reenviar-correo", async (req, res) => {
  const event = db.prepare("SELECT * FROM sd_events WHERE id = ?").get(req.params.eventId);
  const attendee = db.prepare("SELECT * FROM sd_attendees WHERE id = ? AND event_id = ?").get(req.params.attendeeId, req.params.eventId);
  const backTo = `/admin/speed-dating/${req.params.eventId}`;
  if (!event || !attendee || !attendee.email) return res.redirect(backTo);

  const isWoman = attendee.gender === "F";
  const matchRows = db
    .prepare(`SELECT * FROM sd_matches WHERE event_id = ? AND ${isWoman ? "woman_id" : "man_id"} = ?`)
    .all(event.id, attendee.id);
  const matches = matchRows.map((m) => {
    const partnerId = isWoman ? m.man_id : m.woman_id;
    const partner = db.prepare("SELECT name, phone, share_phone_consent FROM sd_attendees WHERE id = ?").get(partnerId);
    return {
      partnerName: partner ? partner.name : "—",
      partnerPhone: partner && partner.share_phone_consent ? partner.phone : null,
    };
  });

  try {
    const { subject, html } = speedDatingMatchEmail({ name: attendee.name, lang: "es", eventName: event.name, matches });
    const result = await sendMail({ to: attendee.email, subject, html });
    const now = new Date().toISOString();
    if (result.sent) {
      db.prepare("UPDATE sd_attendees SET match_email_status = 'sent', match_email_error = NULL, match_email_sent_at = ? WHERE id = ?").run(now, attendee.id);
    } else {
      db.prepare("UPDATE sd_attendees SET match_email_status = 'failed', match_email_error = ? WHERE id = ?").run(result.reason === "error" ? result.error : result.reason || "desconocido", attendee.id);
    }
  } catch (err) {
    console.error("[speedDatingAdmin] Error reenviando correo de resultados —", err.message);
  }
  res.redirect(backTo);
});

// ── Envío manual anticipado del correo de resultados (matching) ─────────
// Botón de excepción puntual en el panel del evento (ver tarjeta arriba) —
// a pedido de Francisco para el evento del 1 de octubre de 2026: permite
// enviar el correo de resultados sin esperar las 48h automáticas de
// services/speedDatingScheduler.js. Reutiliza exactamente la misma lógica
// de envío (sendMatchResultsForEvent), que primero vuelve a calcular los
// matches con persistMatches (para reflejar cualquier voto de respaldo ya
// cargado) y luego envía solo a quien todavía tenga match_email_status
// NULL — así que es seguro usarlo aunque el automático de 48h ya haya
// corrido antes, o si se presiona el botón más de una vez.
router.post("/:eventId/enviar-resultados-ahora", async (req, res) => {
  const backTo = `/admin/speed-dating/${req.params.eventId}`;
  try {
    await speedDatingScheduler.sendMatchResultsForEvent(req.params.eventId);
  } catch (err) {
    console.error("[speedDatingAdmin] Error enviando resultados anticipados —", err.message);
  }
  res.redirect(backTo);
});

// ── Reenvío manual corregido del recordatorio de 1 día antes ────────────
// Botón de emergencia en el panel del evento (ver tarjeta arriba) — usado
// cuando el recordatorio automático salió a la hora o el día equivocado
// (bug de zona horaria corregido en speedDatingReminderScheduler.js,
// 2026-09-30). Resetea la marca de envío y reenvía de inmediato con nota
// de disculpa.
router.post("/:eventId/reenviar-recordatorio-1d", async (req, res) => {
  const backTo = `/admin/speed-dating/${req.params.eventId}`;
  try {
    await speedDatingReminderScheduler.resendReminder1dCorrected(req.params.eventId);
  } catch (err) {
    console.error("[speedDatingAdmin] Error reenviando recordatorio de 1 día corregido —", err.message);
  }
  res.redirect(backTo);
});

// POST /:eventId/recordatorio-mismo-dia — recordatorio manual de último
// momento (ver sendSameDayReminder en services/speedDatingReminderScheduler
// .js): no es automático, Francisco lo dispara a mano el mismo día del
// evento, típicamente unas horas antes.
router.post("/:eventId/recordatorio-mismo-dia", async (req, res) => {
  const backTo = `/admin/speed-dating/${req.params.eventId}`;
  try {
    await speedDatingReminderScheduler.sendSameDayReminder(req.params.eventId);
  } catch (err) {
    console.error("[speedDatingAdmin] Error enviando recordatorio del mismo día —", err.message);
  }
  res.redirect(backTo);
});


// POST /:eventId/enviar-recordatorio-encuesta — recordatorio manual para quien
// no ha contestado la encuesta (ver sendSurveyReminderForEvent en
// services/speedDatingSurveyScheduler.js).
router.post("/:eventId/enviar-recordatorio-encuesta", async (req, res) => {
  const backTo = `/admin/speed-dating/${req.params.eventId}`;
  try {
    await speedDatingSurveyScheduler.sendSurveyReminderForEvent(req.params.eventId);
  } catch (err) {
    console.error("[speedDatingAdmin] Error enviando recordatorio de encuesta —", err.message);
  }
  res.redirect(backTo);
});

// ── Encuesta de satisfacción: tabulación con gráficos (2026-10) ──────────
// Disponible en cualquier momento (no depende de que ya se haya enviado el
// correo) — simplemente muestra las respuestas que existan hasta ahora en
// sd_survey_responses. No pregunta por matches/resultados (esos se
// calculan 48h después, ver services/speedDatingScheduler.js) — esta
// encuesta solo evalúa la experiencia del evento en sí.
router.get("/:eventId/encuesta-resultados", (req, res) => {
  const event = db.prepare("SELECT * FROM sd_events WHERE id = ?").get(req.params.eventId);
  if (!event) return res.status(404).send("Evento no encontrado.");

  const eligible = db
    .prepare(
      `SELECT COUNT(*) AS c FROM sd_attendees WHERE event_id = ? AND cancelled_at IS NULL AND email IS NOT NULL AND TRIM(email) <> ''`
    )
    .get(event.id).c;

  const responses = db
    .prepare(
      `SELECT sr.*, a.name AS attendee_name
       FROM sd_survey_responses sr
       JOIN sd_attendees a ON a.id = sr.attendee_id
       WHERE sr.event_id = ?
       ORDER BY sr.created_at DESC`
    )
    .all(event.id);

  const responseCount = responses.length;
  const responseRate = eligible > 0 ? Math.round((responseCount / eligible) * 100) : 0;

  const SECTIONS = [
    { field: "rating_registro", label: "Registro y llegada" },
    { field: "rating_rondas", label: "El formato de las rondas" },
    { field: "rating_lugar", label: "El lugar y el ambiente" },
    { field: "rating_organizacion", label: "Organización general" },
  ];

  const sectionStats = SECTIONS.map((s) => {
    const values = responses.map((r) => r[s.field]).filter((v) => v != null);
    const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    const counts = [1, 2, 3, 4, 5].map((n) => values.filter((v) => v === n).length);
    return { ...s, avg, total: values.length, counts };
  });

  const npsValues = responses.map((r) => r.nps_score).filter((v) => v != null);
  const promoters = npsValues.filter((n) => n >= 9).length;
  const passives = npsValues.filter((n) => n >= 7 && n <= 8).length;
  const detractors = npsValues.filter((n) => n <= 6).length;
  const npsTotal = npsValues.length;
  const nps = npsTotal > 0 ? Math.round(((promoters - detractors) / npsTotal) * 100) : null;
  const pct = (n) => (npsTotal > 0 ? Math.round((n / npsTotal) * 100) : 0);

  const comments = responses.filter((r) => r.comment && r.comment.trim());

  const RAMP = ["#F0E4D1", BRAND.accentSoft, "#CF9A52", BRAND.accent, BRAND.accentDark];

  function distributionBar(stat) {
    if (!stat.total) {
      return `<p class="muted" style="margin:6px 0 0;font-size:12.5px;">Sin respuestas todavía.</p>`;
    }
    const segs = stat.counts
      .map((c, i) => {
        const pctSeg = Math.round((c / stat.total) * 100);
        if (pctSeg <= 0) return "";
        const dark = i >= 3;
        return `<div style="width:${pctSeg}%;background:${RAMP[i]};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:${dark ? "#fff" : BRAND.ink};min-width:${pctSeg > 0 ? "18px" : "0"};">${pctSeg >= 8 ? pctSeg + "%" : ""}</div>`;
      })
      .join("");
    return `
      <div style="display:flex;width:100%;height:24px;border-radius:7px;overflow:hidden;gap:2px;margin-top:8px;">${segs}</div>
      <div style="display:flex;gap:12px;margin-top:6px;flex-wrap:wrap;font-size:11px;color:${BRAND.muted};">
        ${[1, 2, 3, 4, 5].map((n, i) => `<span style="display:inline-flex;align-items:center;gap:4px;"><i style="width:9px;height:9px;border-radius:2px;background:${RAMP[i]};display:inline-block;"></i>${n} · ${stat.counts[i]}</span>`).join("")}
      </div>`;
  }

  res.send(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Encuesta de satisfacción · ${esc(event.name)}</title><style>${baseStyles()}</style></head>
<body>
  ${topbar()}
  <div class="container">
    <p><a href="/admin/speed-dating/${event.id}" class="muted" style="text-decoration:none;">← Volver al evento</a></p>
    <div class="page-head">
      <span class="eyebrow">Encuesta de satisfacción</span>
      <h1>${esc(event.name)} — <span class="accent-word">cómo les fue</span></h1>
      <p class="lede">Encuesta enviada automáticamente la mañana siguiente al evento, antes del mediodía — no incluye preguntas sobre matches (esos se calculan y envían 48h después).</p>
    </div>

    <div class="card">
      <h2 style="margin:0 0 12px;font-size:15px;">Participación</h2>
      <div style="display:flex;gap:14px;flex-wrap:wrap;">
        <div style="flex:1;min-width:150px;background:${BRAND.light};border-radius:10px;padding:14px 16px;">
          <div style="font-size:28px;font-weight:700;line-height:1;">${responseRate}%</div>
          <div style="font-size:12.5px;color:${BRAND.muted};margin-top:6px;">Tasa de respuesta</div>
        </div>
        <div style="flex:1;min-width:150px;background:${BRAND.light};border-radius:10px;padding:14px 16px;">
          <div style="font-size:28px;font-weight:700;line-height:1;">${responseCount} / ${eligible}</div>
          <div style="font-size:12.5px;color:${BRAND.muted};margin-top:6px;">Invitados que respondieron</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2 style="margin:0 0 4px;font-size:15px;">Calificación promedio por sección</h2>
      <p class="muted" style="margin:0 0 4px;">Escala de 1 a 5.</p>
      ${sectionStats
        .map(
          (s) => `
        <div style="margin:16px 0;">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
            <span style="font-size:13.5px;font-weight:600;">${esc(s.label)}</span>
            <span style="font-size:13.5px;font-weight:700;">${s.avg != null ? s.avg.toFixed(1) : "—"}</span>
          </div>
          ${distributionBar(s)}
        </div>`
        )
        .join("")}
    </div>

    <div class="card">
      <h2 style="margin:0 0 4px;font-size:15px;">Recomendación (0–10)</h2>
      <p class="muted" style="margin:0 0 10px;">"¿Qué tan probable es que recomiendes este evento a un/a amigo/a?" — Promotores: 9–10 · Pasivos: 7–8 · Detractores: 0–6.</p>
      ${
        npsTotal > 0
          ? `
        <div style="font-size:26px;font-weight:700;margin:0 0 2px;">${nps > 0 ? "+" : ""}${nps}</div>
        <p class="muted" style="margin:0 0 10px;">Puntaje NPS (de -100 a 100), sobre ${npsTotal} respuesta${npsTotal === 1 ? "" : "s"}</p>
        <div style="display:flex;width:100%;height:34px;border-radius:8px;overflow:hidden;gap:2px;">
          <div style="width:${pct(promoters)}%;background:${BRAND.green};display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:600;white-space:nowrap;">✓ Promotores · ${pct(promoters)}%</div>
          <div style="width:${pct(passives)}%;background:${BRAND.muted};display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:600;white-space:nowrap;">– Pasivos · ${pct(passives)}%</div>
          <div style="width:${pct(detractors)}%;background:${BRAND.clay};display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:600;white-space:nowrap;">✕ Detractores · ${pct(detractors)}%</div>
        </div>`
          : `<p class="muted">Sin respuestas todavía.</p>`
      }
    </div>

    <div class="card">
      <h2 style="margin:0 0 12px;font-size:15px;">Comentarios abiertos (${comments.length})</h2>
      ${
        comments.length
          ? comments
              .map(
                (c) => `
        <div style="border:1px solid ${BRAND.border};border-radius:10px;padding:12px 14px;margin-bottom:10px;">
          <div style="font-size:12.5px;color:${BRAND.muted};margin-bottom:4px;">${esc(c.attendee_name)} · recomendación ${c.nps_score}/10</div>
          <div style="font-size:13.5px;line-height:1.5;">${esc(c.comment)}</div>
        </div>`
              )
              .join("")
          : `<p class="muted">Todavía no hay comentarios.</p>`
      }
    </div>
  </div>
</body></html>`);
});

module.exports = router;
