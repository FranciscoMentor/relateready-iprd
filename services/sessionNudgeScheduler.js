// services/sessionNudgeScheduler.js
//
// Correo de seguimiento para quien ya desbloqueó su informe completo (con
// código gratis o pagando) y todavía no agendó su sesión de mentoring gratis.
// Mismo patrón que services/reminderScheduler.js: un temporizador (setInterval)
// revisa la base una vez por hora y envía con services/graphMail.js. Sin
// dependencias nuevas.
//
// SEGURIDAD
//  - Apagado por defecto: solo envía si SESSION_NUDGE_ENABLED=true (Render).
//  - simulate() lista a quién le tocaría el correo SIN enviar nada ni escribir
//    en la base. Lo usan la página /admin/seguimiento-sesion, el endpoint
//    /internal/session-nudge/simulate y scripts/simular-seguimiento.js.
//  - El servidor no puede leer Bookings por sí mismo: la tarea programada
//    horaria envía las reservas a /internal/booking-sync (applyBookingEvents),
//    que además deja registrada la hora de esa sincronización. Si la última
//    sincronización tiene más de SESSION_NUDGE_MAX_SYNC_AGE_HOURS (3 por
//    defecto), el envío se pausa: preferimos no escribir antes que escribirle
//    a alguien que ya reservó.
//  - Cada correo se "reclama" en la base antes de enviarse (UPDATE condicional),
//    así que ni dos corridas simultáneas ni un reinicio pueden duplicarlo.
//    Si el envío falla, la marca se revierte y se reintenta en la próxima hora.
//
// QUIÉN RECIBE (todo a la vez)
//  1. Informe desbloqueado (payment_status free/paid/simulated) y correo válido.
//  2. No está en sesion_agendada ni más adelante (sesion_realizada,
//     cliente_mentoring) ni marcada sin_interes.
//  3. Plazo vigente según sessionInfoFor (until existe y no venció).
//  4. Pasaron >= 48 h desde que canjeó el código (code_redeemed_at) o, si no
//     hay fecha de canje, desde que se generó su informe (extended_generated_at).
//     Sin ninguna de las dos fechas no se envía.
//  5. Primer correo: session_nudge_sent_at vacío.
//     Segundo aviso (opcional, solo uno): faltan 2 días o menos para el plazo,
//     el primero se envió hace >= 48 h y session_nudge2_sent_at está vacío.

const db = require("../db/init");
const { sendMail, GRAPH_MAIL_ENABLED } = require("./graphMail");
const { sessionNudgeEmail } = require("./emailTemplates");
const { sessionInfoFor } = require("./sessionDeadline");
const { todayEcuador } = require("./promo");
const { lastSyncAt } = require("./bookingSync");

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // cada hora
const FIRST_CHECK_DELAY_MS = 3 * 60 * 1000;
const MIN_HOURS_AFTER_UNLOCK = 48;
const MIN_HOURS_BETWEEN_NUDGES = 48;
const SECOND_NUDGE_DAYS_BEFORE = 2;
const MAX_PER_RUN = 25;
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const UNLOCKED = ["free", "paid", "simulated"];
const DONE_STATES = ["sesion_agendada", "sesion_realizada", "cliente_mentoring", "sin_interes"];

function enabled() {
  return String(process.env.SESSION_NUDGE_ENABLED || "").trim().toLowerCase() === "true";
}

// Pausa rápida desde el panel (/admin/seguimiento-sesion), sin tocar Render: mientras
// esté en pausa no sale ningún correo aunque el interruptor esté encendido.
function isPaused() {
  const r = db.prepare("SELECT paused FROM session_nudge_pause WHERE id = 1").get();
  return !!(r && r.paused);
}

function setPaused(paused) {
  db.prepare(
    "INSERT INTO session_nudge_pause (id, paused, changed_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET paused = excluded.paused, changed_at = excluded.changed_at"
  ).run(paused ? 1 : 0, new Date().toISOString());
}

// Registro de envíos: a quién se le envió cada correo y cuándo.
function sentLog() {
  return db
    .prepare(
      `SELECT name, email, lang, session_nudge_sent_at AS first, session_nudge2_sent_at AS second
       FROM submissions WHERE session_nudge_sent_at IS NOT NULL OR session_nudge2_sent_at IS NOT NULL
       ORDER BY datetime(COALESCE(session_nudge2_sent_at, session_nudge_sent_at)) DESC`
    )
    .all();
}

function maxSyncAgeHours() {
  const n = Number(process.env.SESSION_NUDGE_MAX_SYNC_AGE_HOURS);
  return n > 0 ? n : 3;
}

function addDays(isoDate, days) {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function syncStatus(now) {
  const at = lastSyncAt();
  const t = at ? Date.parse(at) : NaN;
  const ageHours = Number.isFinite(t) ? (now - t) / 3600000 : null;
  return { lastSyncAt: at || null, ageHours, maxAgeHours: maxSyncAgeHours(), fresh: ageHours !== null && ageHours <= maxSyncAgeHours() };
}

/**
 * Calcula, sin escribir ni enviar nada, quién recibiría el primer correo y quién
 * el segundo aviso, y cuántas personas con informe desbloqueado quedan fuera y
 * por qué.
 */
function simulate(now = Date.now()) {
  const rows = db
    .prepare(
      `SELECT id, name, email, lang, payment_status, payment_reference, code_redeemed_at,
              extended_generated_at, follow_up_status, session_until_override,
              session_nudge_sent_at, session_nudge2_sent_at
       FROM submissions
       WHERE payment_status IN (${UNLOCKED.map(() => "?").join(",")})
       ORDER BY datetime(COALESCE(code_redeemed_at, extended_generated_at)) ASC`
    )
    .all(...UNLOCKED);

  const first = [], second = [];
  const excluded = {};
  const skip = (reason) => { excluded[reason] = (excluded[reason] || 0) + 1; };

  for (const r of rows) {
    const email = String(r.email || "").trim();
    if (!email || !EMAIL_RE.test(email)) { skip("sin correo"); continue; }
    const status = r.follow_up_status || "nuevo";
    if (DONE_STATES.includes(status)) { skip(status === "sesion_agendada" ? "ya agendó su sesión" : "ya en un estado posterior (" + status + ")"); continue; }
    const info = sessionInfoFor(r, now);
    if (!info.until) { skip("sin plazo"); continue; }
    if (info.expired) { skip("plazo vencido"); continue; }
    const unlockedAt = r.code_redeemed_at || r.extended_generated_at;
    const unlockedMs = unlockedAt ? Date.parse(unlockedAt) : NaN;
    if (!Number.isFinite(unlockedMs)) { skip("sin fecha de desbloqueo"); continue; }
    const hoursSince = (now - unlockedMs) / 3600000;

    const item = {
      id: r.id,
      name: r.name || "",
      email,
      lang: r.lang === "en" ? "en" : "es",
      unlockedAt,
      hoursSinceUnlock: Math.floor(hoursSince),
      until: info.until,
      campaign: info.campaign,
      session: { until: info.until },
    };

    if (!r.session_nudge_sent_at) {
      if (hoursSince < MIN_HOURS_AFTER_UNLOCK) { skip("canjeó hace menos de 48 h"); continue; }
      first.push(item);
      continue;
    }
    if (r.session_nudge2_sent_at) { skip("ya recibió los dos correos"); continue; }
    const hoursSinceFirst = (now - Date.parse(r.session_nudge_sent_at)) / 3600000;
    if (todayEcuador(now) < addDays(info.until, -SECOND_NUDGE_DAYS_BEFORE)) { skip("ya recibió el primero (aún no toca el segundo aviso)"); continue; }
    if (!(hoursSinceFirst >= MIN_HOURS_BETWEEN_NUDGES)) { skip("el primero se envió hace menos de 48 h"); continue; }
    second.push({ ...item, firstSentAt: r.session_nudge_sent_at });
  }

  return {
    now: new Date(now).toISOString(),
    switchOn: enabled(),
    paused: isPaused(),
    sent: sentLog(),
    mailConfigured: GRAPH_MAIL_ENABLED,
    sync: syncStatus(now),
    first,
    second,
    excluded,
    unlockedTotal: rows.length,
  };
}

async function sendOne(item, second, now = Date.now()) {
  const col = second ? "session_nudge2_sent_at" : "session_nudge_sent_at";
  // Reclamo atómico: solo una corrida puede marcar esta fila.
  const claim = db
    .prepare(`UPDATE submissions SET ${col} = ? WHERE id = ? AND ${col} IS NULL`)
    .run(new Date(now).toISOString(), item.id);
  if (claim.changes !== 1) return false;
  let result;
  try {
    const { subject, html } = sessionNudgeEmail({ name: item.name, lang: item.lang, session: item.session, second });
    // Las respuestas llegan al buzón remitente, o a SESSION_NUDGE_REPLY_TO si se define en Render.
    result = await sendMail({ to: item.email, subject, html, replyTo: String(process.env.SESSION_NUDGE_REPLY_TO || "").trim() || undefined });
  } catch (err) {
    result = { sent: false, error: err.message };
  }
  if (!result.sent) {
    db.prepare(`UPDATE submissions SET ${col} = NULL WHERE id = ?`).run(item.id);
    console.warn(`[sessionNudge] No se pudo enviar a ${item.email}: ${result.error || result.reason || "error"}. Se reintentará.`);
    return false;
  }
  console.log(`[sessionNudge] ${second ? "Segundo aviso" : "Correo de seguimiento"} enviado a ${item.email} (submission ${item.id}).`);
  return true;
}

async function runOnce(now = Date.now()) {
  if (!enabled()) return { ran: false, reason: "interruptor apagado" };
  if (!GRAPH_MAIL_ENABLED) return { ran: false, reason: "correo automático deshabilitado" };
  if (isPaused()) return { ran: false, reason: "en pausa desde el panel" };
  const sim = simulate(now);
  if (!sim.sync.fresh) {
    console.log(`[sessionNudge] Pausado: la última sincronización con Bookings es ${sim.sync.lastSyncAt || "inexistente"} (máximo ${sim.sync.maxAgeHours} h). No se envía nada.`);
    return { ran: false, reason: "sincronización con Bookings desactualizada" };
  }
  let sent = 0;
  const queue = [...sim.first.map((i) => [i, false]), ...sim.second.map((i) => [i, true])].slice(0, MAX_PER_RUN);
  for (const [item, second] of queue) {
    if (await sendOne(item, second, now)) sent += 1;
  }
  return { ran: true, sent, pending: sim.first.length + sim.second.length - queue.length };
}

function start() {
  if (!enabled()) {
    console.log("[sessionNudge] Apagado (SESSION_NUDGE_ENABLED no es 'true') — no se envía el seguimiento de la sesión gratuita.");
    return;
  }
  if (!GRAPH_MAIL_ENABLED) {
    console.log("[sessionNudge] Correo automático deshabilitado — el seguimiento de la sesión no se activa.");
    return;
  }
  const tick = () => runOnce().catch((err) => console.error("[sessionNudge]", err.message));
  setTimeout(tick, FIRST_CHECK_DELAY_MS);
  setInterval(tick, CHECK_INTERVAL_MS);
  console.log("[sessionNudge] ENCENDIDO — revisa cada hora a quién enviarle el seguimiento de la sesión gratuita.");
}

module.exports = { start, simulate, runOnce, enabled, isPaused, setPaused };
