require("dotenv").config();
const express = require("express");
const session = require("express-session");
const SqliteStore = require("better-sqlite3-session-store")(session);
const path = require("path");

const apiRoutes = require("./routes/api");
const adminRoutes = require("./routes/admin");
const db = require("./db/init");

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
