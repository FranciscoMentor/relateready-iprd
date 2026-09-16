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
router.get("/", (req, res) => {
  const events = db.prepare("SELECT * FROM sd_events ORDER BY created_at DESC").all();
  const rows = events
    .map((e) => {
      const counts = db
        .prepare("SELECT gender, COUNT(*) AS n FROM sd_attendees WHERE event_id = ? GROUP BY gender")
        .all(e.id);
      const w = counts.find((c) => c.gender === "F");
      const m = counts.find((c) => c.gender === "M");
      return `<tr>
        <td><a href="/admin/speed-dating/${e.id}" style="color:${BRAND.ink};font-weight:700;text-decoration:none;">${esc(e.name)}</a><br><span class="muted">${esc(e.event_date) || "sin fecha"}</span></td>
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
    <div class="card">
      <h2 style="margin:0 0 14px;font-size:16px;">Crear nuevo evento</h2>
      <form method="POST" action="/admin/speed-dating" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
        <div><label class="muted" style="display:block;margin-bottom:4px;">Nombre</label><input type="text" name="name" placeholder="Ej. Mila Rooftop — 20 sep" required></div>
        <div><label class="muted" style="display:block;margin-bottom:4px;">Fecha</label><input type="date" name="event_date"></div>
        <div><label class="muted" style="display:block;margin-bottom:4px;">Aforo máximo</label><input type="number" name="capacity" value="24" min="2" max="60" style="width:90px;"></div>
        <button type="submit" class="btn">Crear evento</button>
      </form>
    </div>
    <div class="card">
      <h2 style="margin:0 0 14px;font-size:16px;">Eventos</h2>
      <table>
        <thead><tr><th>Evento</th><th>Estado</th><th>Asistentes</th><th>Creado</th><th></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:#999;padding:24px;">Todavía no hay ningún evento — créalo arriba.</td></tr>'}</tbody>
      </table>
    </div>
  </div>
</body></html>`);
});

router.post("/", express.urlencoded({ extended: true }), (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) return res.redirect("/admin/speed-dating");
  const capacity = Number(req.body.capacity) > 0 ? Number(req.body.capacity) : 24;
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO sd_events (id, created_at, name, event_date, capacity, status, round_state, current_round_number)
     VALUES (?, ?, ?, ?, ?, 'registro', 'esperando_inicio', 0)`
  ).run(id, new Date().toISOString(), name, (req.body.event_date || "").trim() || null, capacity);
  res.redirect(`/admin/speed-dating/${id}`);
});

// ── Dashboard de un evento ───────────────────────────────────────────────
router.get("/:eventId", (req, res) => {
  const event = db.prepare("SELECT * FROM sd_events WHERE id = ?").get(req.params.eventId);
  if (!event) return res.status(404).send("Evento no encontrado.");

  const attendees = db
    .prepare("SELECT * FROM sd_attendees WHERE event_id = ? ORDER BY gender DESC, seat_index ASC")
    .all(event.id);
  const women = attendees.filter((a) => a.gender === "F");
  const men = attendees.filter((a) => a.gender === "M");

  const baseUrl = baseUrlOf(req);
  const registroUrl = `${baseUrl}/evento/${event.id}`;

  const attendeeRows = attendees
    .map((a) => {
      const mesa = a.gender === "F" ? `Mesa fija ${a.table_number}` : `Posición de rotación ${a.seat_index + 1}`;
      const asistenteUrl = `${baseUrl}/speed-dating/asistente.html?token=${a.vote_token}`;
      return `<tr>
        <td>${esc(a.name)}<br><span class="muted">${esc(a.email) || "—"}${a.phone ? " · " + esc(a.phone) : ""}</span></td>
        <td>${a.gender === "F" ? "Mujer" : "Hombre"}</td>
        <td>${mesa}</td>
        <td>${a.share_phone_consent ? "Sí" : "No"}</td>
        <td>${a.match_email_status ? `<span class="badge" style="background:${a.match_email_status === "sent" ? BRAND.green : BRAND.clay}">${a.match_email_status}</span>` : '<span class="muted">—</span>'}
          ${event.status === "finalizado" ? `<form class="inline" method="POST" action="/admin/speed-dating/${event.id}/attendees/${a.id}/reenviar-correo"><button type="submit" class="btn small ghost" style="margin-top:4px;">Reenviar correo</button></form>` : ""}
        </td>
        <td><button type="button" class="btn small ghost" onclick="navigator.clipboard.writeText('${asistenteUrl}').then(()=>{this.textContent='Copiado ✓';setTimeout(()=>this.textContent='Copiar link',1200);})">Copiar link</button></td>
      </tr>`;
    })
    .join("");

  const canIniciar = event.status === "registro" && attendees.length > 0;
  const canCerrarRonda = event.status === "en_curso" && event.round_state === "ronda_activa";
  const canSiguienteRonda = event.status === "en_curso" && (event.round_state === "esperando_inicio" || event.round_state === "cambio_de_mesa");
  const canFinalizar = event.status === "en_curso";
  const isLastTransition = event.round_state === "cambio_de_mesa" && event.current_round_number >= (event.total_rounds || 0);

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
      <p class="lede">${esc(event.event_date) || "Sin fecha"} · Aforo máximo ${event.capacity} asistentes · <span class="accent-word" style="font-weight:700;">${ROUND_STATE_LABEL[event.round_state] || STATUS_LABEL[event.status]}</span></p>
    </div>

    <div class="stats">
      <div class="stat-card"><div class="stat-num">${women.length}</div><div class="stat-label">Mujeres registradas</div></div>
      <div class="stat-card"><div class="stat-num">${men.length}</div><div class="stat-label">Hombres registrados</div></div>
      <div class="stat-card"><div class="stat-num">${event.total_rounds || "—"}</div><div class="stat-label">Rondas totales</div></div>
      <div class="stat-card"><div class="stat-num">${event.current_round_number}</div><div class="stat-label">Ronda actual</div></div>
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

    <div class="card">
      <h2 style="margin:0 0 12px;font-size:15px;">Informe de matching inmediato</h2>
      <p class="muted" style="margin:0 0 12px;">Disponible en cualquier momento, incluso a mitad del evento — no depende del correo automático de 48h.</p>
      <a href="/admin/speed-dating/${event.id}/reporte" class="btn ghost">Ver informe de matching →</a>
    </div>

    <div class="card">
      <h2 style="margin:0 0 14px;font-size:15px;">Asistentes (${attendees.length})</h2>
      <table>
        <thead><tr><th>Persona</th><th>Género</th><th>Mesa</th><th>Autorizó WhatsApp</th><th>Correo de resultados</th><th></th></tr></thead>
        <tbody>${attendeeRows || '<tr><td colspan="6" style="text-align:center;color:#999;padding:24px;">Todavía no hay nadie registrado.</td></tr>'}</tbody>
      </table>
    </div>
  </div>
</body></html>`);
});

// ── Iniciar evento: cierra registro y genera el calendario de rondas ────
router.post("/:eventId/iniciar", (req, res) => {
  const event = db.prepare("SELECT * FROM sd_events WHERE id = ?").get(req.params.eventId);
  if (!event || event.status !== "registro") return res.redirect(`/admin/speed-dating/${req.params.eventId}`);

  const attendees = db
    .prepare("SELECT * FROM sd_attendees WHERE event_id = ? ORDER BY seat_index ASC")
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
