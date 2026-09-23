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
const { generateSchedule, computeMutualMatches, persistMatches } = require("../services/speedDatingMatch");
const { renumberGender } = require("../services/speedDatingAttendees");
const { sendMail } = require("../services/graphMail");
const { speedDatingMatchEmail } = require("../services/emailTemplates");

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

function formatEventDateEs(eventDate) {
  if (!eventDate) return null;
  return new Date(`${eventDate}T00:00:00`).toLocaleDateString("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// Mensaje que se manda por WhatsApp al hacer clic en "Enviar por WhatsApp"
// en el panel — lleva la misma información que ya recibió por correo al
// registrarse (evento, fecha, lugar, mesa si ya la tiene, y su link
// personal), para que sirva igual si perdió el correo o no tiene la
// página abierta en su celular.
function buildWhatsappMessage({ attendee, event, asistenteUrl }) {
  const firstName = (attendee.name || "").trim().split(/\s+/)[0] || attendee.name;
  const formattedDate = formatEventDateEs(event.event_date);
  const lines = [`Hola ${firstName} 👋 Soy del equipo de RelateReady.`, "", `Aquí está tu acceso a *${event.name}*:`];
  if (formattedDate) lines.push(`📅 ${formattedDate}`);
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
        <td><a href="/admin/speed-dating/${e.id}" style="color:${BRAND.ink};font-weight:700;text-decoration:none;">${esc(e.name)}</a><br><span class="muted">${esc(e.event_date) || "sin fecha"}${e.venue_name ? " · " + esc(e.venue_name) : ""}${ageLabel ? " · " + ageLabel : ""}</span></td>
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
    `INSERT INTO sd_events (id, created_at, name, event_date, capacity, status, round_state, current_round_number, venue_name, venue_address, round_questions, min_age, max_age)
     VALUES (?, ?, ?, ?, ?, 'registro', 'esperando_inicio', 0, ?, ?, ?, ?, ?)`
  ).run(
    id,
    new Date().toISOString(),
    name,
    (req.body.event_date || "").trim() || null,
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

  const baseUrl = baseUrlOf(req);
  const registroUrl = `${baseUrl}/evento/${event.id}`;

  const attendeeRows = attendees
    .map((a) => {
      const mesa = a.cancelled_at ? "—" : (a.gender === "F" ? `Mesa fija ${a.table_number}` : `Posición de rotación ${a.seat_index + 1}`);
      const asistenteUrl = `${baseUrl}/speed-dating/asistente.html?token=${a.vote_token}`;
      const waDigits = waPhoneDigits(a.phone);
      const waUrl = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(buildWhatsappMessage({ attendee: a, event, asistenteUrl }))}` : null;
      const cancelBadge = a.cancelled_at
        ? `<br><span class="badge" style="background:${BRAND.clay};margin-top:4px;">Canceló</span>${a.cancellation_reason ? ` <span class="muted">${esc(a.cancellation_reason)}</span>` : ""}`
        : "";
      return `<tr>
        <td>${esc(a.name)}<br><span class="muted">${esc(a.email) || "—"}${a.phone ? " · " + esc(a.phone) : ""}</span>${cancelBadge}</td>
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

  const canIniciar = event.status === "registro" && activeAttendees.length > 0;
  const canCerrarRonda = event.status === "en_curso" && event.round_state === "ronda_activa";
  const canSiguienteRonda = event.status === "en_curso" && (event.round_state === "esperando_inicio" || event.round_state === "cambio_de_mesa");
  const canFinalizar = event.status === "en_curso";
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
      <p class="lede">${esc(event.event_date) || "Sin fecha"}${event.venue_name ? " · " + esc(event.venue_name) : ""}${event.venue_address ? " (" + esc(event.venue_address) + ")" : ""} · Aforo máximo ${event.capacity} asistentes${event.min_age || event.max_age ? " · " + (event.min_age && event.max_age ? `${event.min_age}–${event.max_age} años` : event.min_age ? `${event.min_age}+ años` : `hasta ${event.max_age} años`) : ""} · <span class="accent-word" style="font-weight:700;">${ROUND_STATE_LABEL[event.round_state] || STATUS_LABEL[event.status]}</span></p>
    </div>

    <div class="stats">
      <div class="stat-card"><div class="stat-num">${women.length}</div><div class="stat-label">Mujeres registradas</div></div>
      <div class="stat-card"><div class="stat-num">${men.length}</div><div class="stat-label">Hombres registrados</div></div>
      <div class="stat-card"><div class="stat-num">${event.total_rounds || "—"}</div><div class="stat-label">Rondas totales</div></div>
      <div class="stat-card"><div class="stat-num">${event.current_round_number}</div><div class="stat-label">Ronda actual</div></div>
    </div>

    <div class="card">
      <details>
        <summary style="cursor:pointer;font-size:15px;font-weight:700;color:${BRAND.ink};">✎ Editar evento</summary>
        <form method="POST" action="/admin/speed-dating/${event.id}/editar" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-top:16px;">
          <div><label class="muted" style="display:block;margin-bottom:4px;">Nombre</label><input type="text" name="name" value="${esc(event.name)}" required></div>
          <div><label class="muted" style="display:block;margin-bottom:4px;">Fecha</label><input type="date" name="event_date" value="${esc(event.event_date || "")}"></div>
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
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <form method="POST" action="/admin/speed-dating/${event.id}/iniciar">
          <button type="submit" class="btn" ${canIniciar ? "" : "disabled"}>Cerrar registro e iniciar evento</button>
        </form>
        <form method="POST" action="/admin/speed-dating/${event.id}/cerrar-ronda">
          <button type="submit" class="btn" ${canCerrarRonda ? "" : "disabled"}>Cerrar ronda actual</button>
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

    <div class="card">
      <h2 style="margin:0 0 14px;font-size:15px;">Asistentes (${activeAttendees.length}${attendees.length !== activeAttendees.length ? ` · ${attendees.length - activeAttendees.length} canceló su cupo` : ""})</h2>
      <table>
        <thead><tr><th>Persona</th><th>Género</th><th>Mesa</th><th>Autorizó WhatsApp</th><th>Correo de resultados</th><th></th></tr></thead>
        <tbody>${attendeeRows || '<tr><td colspan="6" style="text-align:center;color:#999;padding:24px;">Todavía no hay nadie registrado.</td></tr>'}</tbody>
      </table>
    </div>
  </div>
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
    `UPDATE sd_events SET name = ?, event_date = ?, capacity = ?, venue_name = ?, venue_address = ?, round_questions = ?, min_age = ?, max_age = ? WHERE id = ?`
  ).run(name, eventDate, capacity, venueName, venueAddress, roundQuestions, minAge, maxAge, event.id);

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

module.exports = router;
