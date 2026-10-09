// services/backupService.js
//
// Respaldo propio de la base de datos, independiente de Render (2026-10).
// Render ya toma un snapshot diario del disco, pero solo lo guarda 7 días,
// se restaura completo (todo o nada) y vive dentro de la misma cuenta de
// Render. Este servicio guarda una copia aparte, fuera de Render:
//
//   - Cada domingo a las 03:00 (hora de Ecuador) genera una copia consistente
//     de la base de datos y se la envía por correo a BACKUP_EMAIL_TO (por
//     defecto, adamantinementor@outlook.com — el correo que Francisco tiene
//     configurado en su computador).
//   - El panel de control puede enviarla a demanda ("Enviar respaldo ahora")
//     o descargarla directamente ("Descargar respaldo").
//   - Cada intento queda en la tabla backup_log, y el panel muestra el estado
//     real del último respaldo y avisa si falló o si ya pasó demasiado tiempo.
//
// La copia se hace con db.backup() de better-sqlite3 (copia en línea
// consistente, segura aunque el sitio esté recibiendo escrituras), se le
// quita la tabla de sesiones del panel (no hace falta respaldarla y evita
// guardar cookies de sesión), se verifica con PRAGMA integrity_check y se
// comprime con gzip. Para restaurar: scripts/restore-backup.js.
//
// Límite: Microsoft Graph acepta adjuntos de hasta ~3 MB enviados en línea
// (sendMail). Si la copia comprimida lo supera, NO falla en silencio: se
// envía un correo de aviso sin adjunto y el estado queda 'too_large' en rojo
// en el panel — el descargable del panel no tiene ese límite.

const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const { promisify } = require("util");
const db = require("../db/init");
const { sendMail, GRAPH_MAIL_ENABLED } = require("./graphMail");

const gzip = promisify(zlib.gzip);

const DEFAULT_BACKUP_TO = "adamantinementor@outlook.com";
const BACKUP_TO = process.env.BACKUP_EMAIL_TO || DEFAULT_BACKUP_TO;
const MAX_ATTACHMENT_BYTES = 2_900_000; // por debajo del límite de ~3 MB de Graph para adjuntos en línea
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // cada hora
const FIRST_CHECK_DELAY_MS = 3 * 60 * 1000; // 3 min después de arrancar
const RETRY_AFTER_MS = 6 * 60 * 60 * 1000; // si un intento falla, no reintentar antes de 6 h
const SLOT_UTC_HOUR = 8; // 08:00 UTC = 03:00 en Ecuador (UTC-5, sin horario de verano)
const STALE_AFTER_MS = 8 * 24 * 60 * 60 * 1000; // el panel avisa si el último envío exitoso tiene más de 8 días

function logAttempt(kind, status, bytes, error) {
  db.prepare("INSERT INTO backup_log (created_at, kind, status, bytes, error) VALUES (?,?,?,?,?)").run(
    new Date().toISOString(),
    kind,
    status,
    bytes === undefined ? null : bytes,
    error || null
  );
}

/**
 * Genera la copia: { gz: Buffer, rawBytes, counts, integrity }.
 * Usa un archivo temporal en el directorio temporal del sistema (NO en el
 * disco persistente) y siempre lo borra al terminar.
 */
async function createBackup() {
  const tmp = path.join(os.tmpdir(), `relateready-backup-${process.pid}-${Date.now()}.sqlite`);
  try {
    await db.backup(tmp);

    const Database = require("better-sqlite3");
    const copy = new Database(tmp);
    let integrity = "desconocido";
    const counts = {};
    try {
      // La tabla de sesiones del panel no hace falta respaldarla.
      try { copy.exec("DELETE FROM sessions"); } catch (e) { /* la tabla puede no existir */ }
      copy.pragma("journal_mode = DELETE"); // un solo archivo autocontenido, sin -wal
      copy.exec("VACUUM");
      integrity = copy.pragma("integrity_check", { simple: true });
      for (const t of ["submissions", "sd_events", "sd_attendees", "sd_votes", "sd_matches", "sd_survey_responses", "test_invitations"]) {
        try { counts[t] = copy.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c; } catch (e) { /* tabla ausente */ }
      }
    } finally {
      copy.close();
    }

    const raw = fs.readFileSync(tmp);
    const gz = await gzip(raw, { level: 9 });
    return { gz, rawBytes: raw.length, counts, integrity };
  } finally {
    for (const suffix of ["", "-wal", "-shm", "-journal"]) {
      try { fs.unlinkSync(tmp + suffix); } catch (e) { /* no existe */ }
    }
  }
}

function backupFilename(date = new Date()) {
  return `relateready-respaldo-${date.toISOString().slice(0, 10)}.sqlite.gz`;
}

function fmtBytes(n) {
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + " MB";
  return Math.max(1, Math.round(n / 1024)) + " KB";
}

function backupEmailHtml({ ok, tooLarge, filename, gzBytes, rawBytes, counts, integrity, kind }) {
  const countsList = Object.entries(counts || {})
    .map(([t, c]) => `<li>${t}: <strong>${c}</strong></li>`)
    .join("");
  const when = new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" });
  const title = tooLarge
    ? "El respaldo de RelateReady NO pudo adjuntarse (demasiado grande)"
    : `Respaldo ${kind === "weekly" ? "semanal" : "manual"} de RelateReady`;
  const body = tooLarge
    ? `<p>La copia comprimida pesa <strong>${fmtBytes(gzBytes)}</strong> y supera el límite de ~3 MB para adjuntos por correo, así que esta vez <strong>no se adjuntó</strong>.</p>
       <p>Descárgala desde <strong>Panel de control → Inicio → Respaldo de datos → Descargar respaldo</strong>. Para los próximos respaldos automáticos habrá que guardarlos en OneDrive en vez de por correo — avísale a Claude.</p>`
    : `<p>Adjunto está el archivo <strong>${filename}</strong> (${fmtBytes(gzBytes)}), una copia completa y verificada de la base de datos al ${when} (hora de Ecuador).</p>
       <p>Verificación de integridad: <strong>${integrity}</strong>. Tamaño sin comprimir: ${fmtBytes(rawBytes)}.</p>
       <p>Contenido:</p><ul>${countsList}</ul>
       <p style="color:#6B6259;font-size:13px;">Contiene correos, teléfonos y respuestas de tus clientes: guárdalo en un lugar privado y no lo reenvíes. Para restaurarlo: <code>node scripts/restore-backup.js ${filename}</code> (ver instrucciones en ese archivo del proyecto).</p>`;
  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#2A2A28;max-width:560px;">
    <h2 style="color:${tooLarge ? "#9C3B2E" : "#B5732A"};font-size:18px;">${title}</h2>${body}</div>`;
}

/**
 * Genera la copia y la envía por correo. kind: 'weekly' | 'manual'.
 * Nunca lanza: siempre registra el resultado en backup_log y resuelve
 * { status, error?, bytes? }.
 */
async function sendBackupEmail(kind = "manual") {
  if (!GRAPH_MAIL_ENABLED || !BACKUP_TO) {
    const error = !GRAPH_MAIL_ENABLED
      ? "El correo automático (GRAPH_*) no está configurado."
      : "No hay destinatario: define BACKUP_EMAIL_TO.";
    logAttempt(kind, "disabled", undefined, error);
    return { status: "disabled", error };
  }
  let backup;
  try {
    backup = await createBackup();
  } catch (err) {
    console.error("[backup] Error generando la copia —", err.message);
    logAttempt(kind, "failed", undefined, "No se pudo generar la copia: " + err.message);
    return { status: "failed", error: "No se pudo generar la copia: " + err.message };
  }

  const filename = backupFilename();
  const { gz, rawBytes, counts, integrity } = backup;
  const info = { filename, gzBytes: gz.length, rawBytes, counts, integrity, kind };

  if (integrity !== "ok") {
    // Una copia dañada no se envía como si estuviera bien.
    const error = `La verificación de integridad de la copia falló: ${integrity}`;
    logAttempt(kind, "failed", gz.length, error);
    return { status: "failed", error };
  }

  if (gz.length > MAX_ATTACHMENT_BYTES) {
    const result = await sendMail({
      to: BACKUP_TO,
      subject: "⚠ Respaldo de RelateReady demasiado grande para adjuntar",
      html: backupEmailHtml({ ...info, tooLarge: true }),
    });
    const error = `La copia comprimida (${fmtBytes(gz.length)}) supera el límite de adjuntos por correo.` +
      (result.sent ? "" : " Además, falló el correo de aviso: " + (result.error || result.reason));
    logAttempt(kind, "too_large", gz.length, error);
    return { status: "too_large", error, bytes: gz.length };
  }

  const result = await sendMail({
    to: BACKUP_TO,
    subject: `Respaldo RelateReady — ${new Date().toISOString().slice(0, 10)}`,
    html: backupEmailHtml({ ...info, ok: true }),
    attachments: [{ filename, contentBytes: gz, contentType: "application/gzip" }],
  });
  if (!result.sent) {
    const error = result.error || result.reason || "Error desconocido";
    logAttempt(kind, "failed", gz.length, error);
    return { status: "failed", error, bytes: gz.length };
  }
  logAttempt(kind, "sent", gz.length);
  console.log(`[backup] Respaldo ${kind} enviado a ${BACKUP_TO} (${fmtBytes(gz.length)}).`);
  return { status: "sent", bytes: gz.length };
}

/** Anota una descarga manual desde el panel (para el historial). */
function logDownload(bytes) {
  logAttempt("download", "downloaded", bytes);
}

// ── Programación semanal ───────────────────────────────────────────────────

/** Último domingo a las 08:00 UTC (03:00 Ecuador) que ya pasó respecto a `now`. */
function lastSlot(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), SLOT_UTC_HOUR, 0, 0));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // getUTCDay(): domingo = 0
  if (d > now) d.setUTCDate(d.getUTCDate() - 7);
  return d;
}

/**
 * ¿Toca enviar el respaldo semanal? Sí si desde el último domingo 03:00
 * (Ecuador) todavía no hay un envío semanal exitoso, y no hubo otro intento
 * (fallido) en las últimas 6 horas. Si el servidor estuvo apagado el
 * domingo, se recupera en cuanto arranca.
 */
function isDue(now = new Date()) {
  const slot = lastSlot(now).toISOString();
  const okSince = db
    // 'too_large' cuenta como atendido para no reenviar el correo de aviso cada
    // 6 horas; el panel igual lo muestra en rojo hasta que haya un envío exitoso.
    .prepare("SELECT 1 FROM backup_log WHERE kind = 'weekly' AND status IN ('sent','too_large') AND created_at >= ? LIMIT 1")
    .get(slot);
  if (okSince) return false;
  const last = db.prepare("SELECT created_at FROM backup_log WHERE kind = 'weekly' ORDER BY id DESC LIMIT 1").get();
  if (last && now - new Date(last.created_at) < RETRY_AFTER_MS) return false;
  return true;
}

async function runIfDue() {
  if (!isDue()) return;
  await sendBackupEmail("weekly");
}

function start() {
  if (!GRAPH_MAIL_ENABLED) {
    console.log("[backup] Correo automático deshabilitado — el respaldo semanal por correo no se activa.");
    return;
  }
  setTimeout(() => runIfDue().catch((err) => console.error("[backup]", err.message)), FIRST_CHECK_DELAY_MS);
  setInterval(() => runIfDue().catch((err) => console.error("[backup]", err.message)), CHECK_INTERVAL_MS);
  console.log(`[backup] Activo — respaldo semanal (domingos 03:00 Ecuador) por correo a ${BACKUP_TO || "(sin destinatario)"}.`);
}

/** Estado para el panel: último envío exitoso, último intento, historial y si está atrasado. */
function getStatus() {
  const lastSent = db.prepare("SELECT created_at, kind, bytes FROM backup_log WHERE status = 'sent' ORDER BY id DESC LIMIT 1").get() || null;
  const lastAttempt = db
    .prepare("SELECT created_at, kind, status, bytes, error FROM backup_log WHERE kind IN ('weekly','manual') ORDER BY id DESC LIMIT 1")
    .get() || null;
  const history = db.prepare("SELECT created_at, kind, status, bytes, error FROM backup_log ORDER BY id DESC LIMIT 6").all();
  const stale = !lastSent || Date.now() - new Date(lastSent.created_at) > STALE_AFTER_MS;
  const lastAttemptFailed = !!lastAttempt && ["failed", "too_large", "disabled"].includes(lastAttempt.status);
  return {
    enabled: GRAPH_MAIL_ENABLED && !!BACKUP_TO,
    recipient: BACKUP_TO || null,
    schedule: "Semanal · domingos 03:00 (hora de Ecuador)",
    lastSent,
    lastAttempt,
    history,
    stale,
    needsAttention: stale || lastAttemptFailed,
  };
}

module.exports = { start, createBackup, backupFilename, sendBackupEmail, logDownload, getStatus, isDue, lastSlot };
