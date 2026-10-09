require("dotenv").config();
const express = require("express");
const session = require("express-session");
const SqliteStore = require("better-sqlite3-session-store")(session);
const path = require("path");

const apiRoutes = require("./routes/api");
const adminRoutes = require("./routes/admin");
const speedDatingAdminRoutes = require("./routes/speedDatingAdmin");
const speedDatingPublicRoutes = require("./routes/speedDatingPublic");
const db = require("./db/init");
const reminderScheduler = require("./services/reminderScheduler");
const backupService = require("./services/backupService");
const speedDatingScheduler = require("./services/speedDatingScheduler");
const speedDatingReminderScheduler = require("./services/speedDatingReminderScheduler");
const speedDatingSurveyScheduler = require("./services/speedDatingSurveyScheduler");

const app = express();
app.set("trust proxy", 1); // necesario en Render para que req.protocol refleje https
app.use(express.json({ limit: "2mb" }));

// Sesión del panel de administración (login propio en /admin/login), guardada
// en la misma base SQLite en vez del MemoryStore por defecto de
// express-session, que pierde todo en cada reinicio del servidor en Render
// y acumula memoria indefinidamente en producción.
app.use(session({
  store: new SqliteStore({
    client: db,
    expired: { clear: true, intervalMs: 15 * 60 * 1000 }, // limpia sesiones vencidas cada 15 min
  }),
  secret: process.env.SESSION_SECRET || "cambia-esto-en-produccion",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 }, // 8 horas
}));

// IMPORTANTE (mismo problema que ya vivió el panel de SQ Assessment en
// producción): sin 'no-cache' en los .html, el navegador puede quedarse
// mostrando una versión vieja de una página después de un despliegue nuevo,
// incluso recargando. 'no-cache' no desactiva el cacheo — obliga al
// navegador a revalidar con el servidor en cada carga.
app.use(express.static(path.join(__dirname, "public"), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-cache");
    }
  },
}));

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api", apiRoutes);
app.use("/admin", adminRoutes);

// Piloto de speed dating (Mila Rooftop, 2026-09) — panel del organizador
// bajo /admin/speed-dating (misma sesión de administrador que el resto del
// panel, ver routes/admin.js) y endpoints públicos del celular de cada
// asistente bajo /api/speed-dating (sin login, protegidos por el
// vote_token de cada persona en vez de una cuenta — ver routes/speedDatingPublic.js).
// Direcciones nuevas (2026-10, nombre "Encuentro RelateReady"): panel en
// /admin/encuentros y páginas públicas en /encuentro/. Las direcciones viejas
// (/admin/speed-dating y /speed-dating/...) siguen funcionando: redirigen a
// las nuevas conservando todo lo que viene después, incluido el token
// personal (?token=...) de los enlaces ya enviados por correo.
app.use("/admin/speed-dating", (req, res) => {
  res.redirect(req.method === "GET" || req.method === "HEAD" ? 301 : 308, "/admin/encuentros" + req.url);
});
app.use("/speed-dating", (req, res) => {
  const newPath = req.url === "/speed-dating.css" || req.url.startsWith("/speed-dating.css?")
    ? req.url.replace("/speed-dating.css", "/encuentro.css")
    : req.url;
  res.redirect(301, "/encuentro" + newPath);
});
app.use("/admin/encuentros", adminRoutes.requireAuth, speedDatingAdminRoutes);
app.use("/api/speed-dating", speedDatingPublicRoutes);

// Link corto y fácil de compartir para el registro de un evento —
// redirige a la página de registro real en /public con el id del evento
// como query param. Así el link que copia el organizador (ver panel,
// /admin/speed-dating/:id) es "…/evento/<id>" en vez de la ruta interna del
// archivo estático.
app.get("/evento/:eventId", (req, res) => {
  res.redirect(`/encuentro/registro.html?evento=${encodeURIComponent(req.params.eventId)}`);
});

// Panel de control completo (KPIs, resultados con detalle por persona,
// calendario de Microsoft 365) en su propia URL de nivel superior — a
// propósito NO anidada bajo /admin, mismo patrón que el panel de referencia
// de SQ Assessment. Usa el mismo login que /admin (requireAuth exportado
// desde routes/admin.js), así que exige la misma sesión iniciada.
app.get("/panel-control", adminRoutes.requireAuth, (req, res) => {
  res.set("Cache-Control", "no-cache");
  res.sendFile(path.join(__dirname, "views", "panel.html"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`RelateReady escuchando en el puerto ${PORT}`);
  console.log(`  Test público:      http://localhost:${PORT}/`);
  console.log(`  Admin (básico):    http://localhost:${PORT}/admin`);
  console.log(`  Panel de control:  http://localhost:${PORT}/panel-control`);
});

// Recordatorio automático de 24-48h para tests completados sin comprar (ver
// services/reminderScheduler.js) — se activa solo si el correo automático
// está configurado (GRAPH_* en Environment).
reminderScheduler.start();

// Respaldo semanal de la base de datos por correo (domingos 03:00 hora de
// Ecuador) — ver services/backupService.js. Mismo criterio: solo se activa
// si el correo automático está configurado.
backupService.start();

// Correo de resultados a las 48h de finalizar un evento de speed dating
// (ver services/speedDatingScheduler.js) — mismo criterio: solo se activa
// si el correo automático está configurado.
speedDatingScheduler.start();

// Recordatorios automáticos de 3 días y 1 día antes de cada evento de
// speed dating (ver services/speedDatingReminderScheduler.js) — mismo
// criterio: solo se activa si el correo automático está configurado.
speedDatingReminderScheduler.start();

// Encuesta corta de satisfacción la mañana siguiente al evento, antes del
// mediodía (hora de Ecuador) — ver services/speedDatingSurveyScheduler.js.
// Mismo criterio: solo se activa si el correo automático está configurado.
speedDatingSurveyScheduler.start();
