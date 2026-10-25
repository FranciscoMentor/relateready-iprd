// routes/campaignCode.js
// Datos de análisis de una campaña con código gratuito (cada campaña tiene su
// propio código y fechas, y se crea desde el panel). Se monta en /admin/api/campana-codigo
// (detrás del login de administrador) y alimenta la pestaña "Campañas con código" de /panel-control; muestra: cuántos tests se completaron,
// cuántos canjearon el código, de qué anuncio/campaña llegó cada persona (por
// los parámetros utm_* guardados al terminar el test), el avance diario y la
// descarga del detalle en CSV. Casi todo es lectura; la única escritura es /sync-sessions, que marca como "sesion_agendada" a quien agendó en Bookings.
//
// Parámetros (todos opcionales): ?campaign=<id> o ?code=<CODIGO>&from=AAAA-MM-DD&to=AAAA-MM-DD
// Las fechas se interpretan en hora de Ecuador (UTC-5).

const express = require("express");
const router = express.Router();
const db = require("../db/init");

// Campañas guardadas (nombre, código, fechas). Cada campaña es solo una
// "vista" de los envíos que canjearon ese código en ese rango: crear, editar o
// borrar una campaña aquí NUNCA toca los envíos ni los códigos del sitio.
// Para que un código nuevo funcione en el test hay que agregarlo también a la
// variable FREE_ACCESS_CODES en Render.
// (La tabla campaigns y su columna one_click se crean en db/init.js. Ya no se
// siembra ninguna campaña: las promociones se crean desde el panel.)

const TZ_OFFSET_HOURS = -5; // Ecuador
// Sin campaña seleccionada no hay código ni fechas fijas: se usa el último mes.
const DEFAULT_CODE = "";
const defaultTo = () => localDay(new Date().toISOString());
const defaultFrom = () => localDay(new Date(Date.now() - 30 * 86400000).toISOString());
const SESSION_STATES = ["sesion_agendada", "sesion_realizada", "cliente_mentoring"];

function validDate(s, fallback) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) ? s : fallback; }
function localDay(iso) {
  const t = new Date(iso);
  if (isNaN(t)) return "";
  return new Date(t.getTime() + TZ_OFFSET_HOURS * 3600000).toISOString().slice(0, 10);
}

function loadCampaign(query) {
  let saved = null;
  if (query.campaign) saved = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(Number(query.campaign));
  const code = String((saved ? saved.code : query.code) || DEFAULT_CODE).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "") || DEFAULT_CODE;
  const from = validDate(saved ? saved.date_from : query.from, defaultFrom());
  const to = validDate(saved ? saved.date_to : query.to, defaultTo());
  // Rango en UTC: inicio del día "from" y fin del día "to" en hora de Ecuador.
  const startUtc = new Date(Date.parse(from + "T00:00:00Z") - TZ_OFFSET_HOURS * 3600000).toISOString();
  const endUtc = new Date(Date.parse(to + "T00:00:00Z") + 86400000 - TZ_OFFSET_HOURS * 3600000).toISOString();

  const rows = db
    .prepare(
      `SELECT id, created_at, name, email, phone, city, country, lang, payment_status, payment_reference,
              code_redeemed_at, summary_viewed_at, unlock_clicked_at, extended_generated_at, extended_email_status, follow_up_status,
              utm_source, utm_medium, utm_campaign, utm_content, utm_term, from_meta_ad
         FROM submissions WHERE created_at >= ? AND created_at < ? ORDER BY created_at ASC`
    )
    .all(startUtc, endUtc);

  const isCode = (r) => r.payment_reference === "CODE:" + code;
  const campaignOf = (r) => r.utm_campaign || (r.from_meta_ad ? "(anuncio de Meta sin utm)" : "(directo o sin utm)");

  const redeemed = rows.filter(isCode);
  const summary = {
    tests: rows.length,
    redeemed: redeemed.length,
    paid: rows.filter((r) => r.payment_status === "paid").length,
    notConverted: rows.filter((r) => r.payment_status === "pending").length,
    reportGenerated: redeemed.filter((r) => r.extended_generated_at).length,
    emailSent: redeemed.filter((r) => r.extended_email_status === "sent").length,
    sessions: redeemed.filter((r) => SESSION_STATES.includes(r.follow_up_status)).length,
    fromMeta: rows.filter((r) => r.from_meta_ad).length,
    // Embudo del relanzamiento: resumen visto con la tarjeta de desbloqueo,
    // botón de un clic pulsado (solo cuentan envíos con esa marca).
    summaryViewed: rows.filter((r) => r.summary_viewed_at).length,
    unlockClicked: rows.filter((r) => r.unlock_clicked_at).length,
  };

  function groupBy(keyFn) {
    const m = new Map();
    for (const r of rows) {
      const k = keyFn(r);
      if (k === null) continue;
      const g = m.get(k) || { key: k, tests: 0, redeemed: 0, sessions: 0 };
      g.tests++;
      if (isCode(r)) {
        g.redeemed++;
        if (SESSION_STATES.includes(r.follow_up_status)) g.sessions++;
      }
      m.set(k, g);
    }
    return [...m.values()].sort((a, b) => b.tests - a.tests);
  }

  // Avance diario: tests por día de creación y canjes por día de canje.
  const days = new Map();
  const dayRow = (d) => days.get(d) || days.set(d, { day: d, tests: 0, redeemed: 0 }).get(d);
  rows.forEach((r) => { const d = localDay(r.created_at); if (d) dayRow(d).tests++; });
  redeemed.forEach((r) => { const d = localDay(r.code_redeemed_at || r.created_at); if (d) dayRow(d).redeemed++; });
  const byDay = [...days.values()].sort((a, b) => (a.day < b.day ? -1 : 1));

  return {
    campaign: saved ? { id: saved.id, name: saved.name } : null,
    code, from, to, rows, summary, isCode,
    byDay,
    byCampaign: groupBy(campaignOf),
    byAd: groupBy((r) => (r.utm_content ? r.utm_content : null)),
    bySourceMedium: groupBy((r) => `${r.utm_source || "(sin source)"} / ${r.utm_medium || "(sin medium)"}`),
    byCountry: groupBy((r) => (r.country ? r.country.trim() : "(sin país)")),
    byLang: groupBy((r) => (r.lang === "en" ? "Inglés" : "Español")),
  };
}

// Sincroniza las sesiones agendadas en Outlook Bookings. El panel lee el
// calendario (con la cuenta de Microsoft conectada en la pestaña Calendario)
// y envía aquí los eventos con invitados: { events: [{ id, subject, start, emails: [] }] }.
// Si el correo de un invitado coincide con el de un test, esa ficha pasa a
// "sesion_agendada" (solo si estaba en nuevo o contactado: nunca se baja un estado posterior).
router.post("/sync-sessions", (req, res) => {
  const events = Array.isArray(req.body && req.body.events) ? req.body.events.slice(0, 1000) : [];
  const find = db.prepare("SELECT id, name, email, follow_up_status, follow_up_notes FROM submissions WHERE lower(email) = ? ORDER BY id DESC LIMIT 1");
  const upd = db.prepare("UPDATE submissions SET follow_up_status = 'sesion_agendada', follow_up_notes = ? WHERE id = ?");
  const matched = [];
  let alreadyKnown = 0, checked = 0;
  for (const ev of events) {
    const when = String(ev.start || "").slice(0, 16).replace("T", " ");
    const tag = "Sesión agendada (Bookings): " + when + (ev.id ? " [" + String(ev.id).slice(-12) + "]" : "");
    for (const raw of Array.isArray(ev.emails) ? ev.emails.slice(0, 10) : []) {
      const email = String(raw || "").trim().toLowerCase();
      if (!email || email.length > 200) continue;
      checked++;
      const row = find.get(email);
      if (!row) continue;
      if (row.follow_up_notes && ev.id && row.follow_up_notes.includes("[" + String(ev.id).slice(-12) + "]")) { alreadyKnown++; continue; }
      if (row.follow_up_status === "nuevo" || row.follow_up_status === "contactado") {
        upd.run((row.follow_up_notes ? row.follow_up_notes + "\n" : "") + tag, row.id);
        matched.push({ name: row.name, email: row.email, start: when });
      } else {
        alreadyKnown++;
      }
    }
  }
  res.json({ ok: true, eventsRead: events.length, matched, alreadyKnown });
});

// Lista de campañas guardadas.
router.get("/list", (req, res) => {
  res.json(db.prepare("SELECT id, name, code, date_from AS \"from\", date_to AS \"to\", one_click AS oneClick, session_until AS sessionUntil FROM campaigns ORDER BY id DESC").all());
});

// Crea o actualiza una campaña: { id?, name, code, from, to, oneClick }.
router.post("/save", (req, res) => {
  const b = req.body || {};
  const name = String(b.name || "").trim().slice(0, 120);
  const code = String(b.code || "").trim().toUpperCase();
  const from = String(b.from || "");
  const to = String(b.to || "");
  const oneClick = b.oneClick ? 1 : 0;
  // Fecha límite para agendar la sesión gratuita; vacía = igual que "Hasta".
  const sessionUntil = String(b.sessionUntil || "").trim() || null;
  if (sessionUntil && (!/^\d{4}-\d{2}-\d{2}$/.test(sessionUntil) || sessionUntil < from)) {
    return res.status(400).json({ error: "Revisa la fecha límite de la sesión gratuita: no puede ser anterior a la fecha inicial." });
  }
  if (!name) return res.status(400).json({ error: "Escribe un nombre para la campaña." });
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return res.status(400).json({ error: "El código debe tener de 3 a 30 letras, números, guiones o guion bajo." });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) {
    return res.status(400).json({ error: "Revisa las fechas: la fecha final no puede ser anterior a la inicial." });
  }
  if (b.id) {
    const r = db.prepare("UPDATE campaigns SET name=?, code=?, date_from=?, date_to=?, one_click=?, session_until=? WHERE id=?").run(name, code, from, to, oneClick, sessionUntil, Number(b.id));
    if (!r.changes) return res.status(404).json({ error: "No se encontró esa campaña." });
    return res.json({ ok: true, id: Number(b.id) });
  }
  const r = db.prepare("INSERT INTO campaigns (name, code, date_from, date_to, one_click, session_until, created_at) VALUES (?,?,?,?,?,?,?)").run(name, code, from, to, oneClick, sessionUntil, new Date().toISOString());
  res.json({ ok: true, id: Number(r.lastInsertRowid) });
});

// Borra solo la definición de la campaña (nunca los envíos).
router.post("/delete", (req, res) => {
  const id = Number((req.body || {}).id);
  if (!id) return res.status(400).json({ error: "Falta la campaña." });
  db.prepare("DELETE FROM campaigns WHERE id = ?").run(id);
  res.json({ ok: true });
});

// JSON para la pestaña "Campañas con código" de /panel-control.
router.get("/", (req, res) => {
  const d = loadCampaign(req.query);
  res.json({
    campaign: d.campaign,
    code: d.code,
    from: d.from,
    to: d.to,
    summary: d.summary,
    byDay: d.byDay,
    byCampaign: d.byCampaign,
    byAd: d.byAd,
    bySourceMedium: d.bySourceMedium,
    byCountry: d.byCountry,
    byLang: d.byLang,
  });
});

router.get("/export.csv", (req, res) => {
  const d = loadCampaign(req.query);
  const headers = ["Fecha del test", "Fecha del canje", "Resumen visto", "Pulsó desbloquear", "Nombre", "Correo", "Teléfono", "País", "Ciudad", "Idioma", "Canjeó el código", "Estado de pago", "Referencia", "Informe generado", "Correo del informe", "Seguimiento", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "Clic de anuncio de Meta"];
  const csvEscape = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const lines = [headers.join(",")];
  d.rows.forEach((r) => {
    lines.push([
      r.created_at, r.code_redeemed_at, r.summary_viewed_at, r.unlock_clicked_at, r.name, r.email, r.phone, r.country, r.city,
      r.lang === "en" ? "Inglés" : "Español", d.isCode(r) ? "Sí" : "No", r.payment_status, r.payment_reference,
      r.extended_generated_at ? "Sí" : "No", r.extended_email_status, r.follow_up_status,
      r.utm_source, r.utm_medium, r.utm_campaign, r.utm_content, r.utm_term, r.from_meta_ad ? "Sí" : "No",
    ].map(csvEscape).join(","));
  });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="relateready-campana-${d.code}-${d.from}-a-${d.to}.csv"`);
  res.send("﻿" + lines.join("\n"));
});

module.exports = router;
module.exports.loadCampaign = loadCampaign;
