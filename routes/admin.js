// routes/admin.js
// Panel de administración de RelateReady: lista de envíos del test (/admin,
// vista básica) y el panel de control completo (/panel-control, servido
// desde server.js con este mismo requireAuth) — KPIs, detalle por persona
// con las 8 dimensiones, seguimiento comercial, y calendario de Microsoft
// 365. Migrado de HTTP Basic Auth a sesión propia (express-session) con
// página de login de marca, mismo patrón que el panel de referencia de
// Adamantine SQ Assessment/Mentoring.

const express = require("express");
const router = express.Router();
const db = require("../db/init");
const { DIMENSIONS } = require("../data/dimensions");

const EXTENDED_PRICE_CENTS = Number(process.env.EXTENDED_PRICE_CENTS) > 0 ? Number(process.env.EXTENDED_PRICE_CENTS) : 2499;

// ─────────────────────────── Marca / estilos compartidos ───────────────────────────
// Identidad de RelateReady (distinta de la paleta "Mentoring Brand Board"
// que usa el panel de SQ Assessment) — ver public/css/styles.css :root.
const BRAND = {
  accent: "#B5732A", // ámbar/bronce
  ink: "#2A2A28",    // texto
  muted: "#6B6259",  // gris apagado
  green: "#3F6B4F",  // Fortaleza
  amber: "#9C6B14",  // Funcional
  clay: "#9C3B2E",   // Área de desarrollo
  cream: "#F4F0E9",  // fondos suaves
  light: "#ECE4D6",  // beige claro
  border: "#DDD6CE",
};

const BAND_COLOR = { f: BRAND.green, m: BRAND.amber, d: BRAND.clay };
const BAND_LABEL = { f: "Fortaleza", m: "Funcional", d: "Área de desarrollo" };

function esc(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Solo redirige a una ruta relativa segura dentro del propio sitio — nunca a una URL externa completa. */
function safeNext(value) {
  return value && typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/admin";
}

/**
 * Middleware: exige sesión de administrador iniciada.
 * Recuerda a dónde iba el usuario (req.originalUrl) para devolverlo ahí
 * mismo después de iniciar sesión — así /panel-control te deja en
 * /panel-control y no siempre en /admin.
 *
 * Las rutas /api/* (usadas por fetch() desde /panel-control) devuelven un
 * 401 en JSON en vez de redirigir a /admin/login: si dejáramos que
 * redirigiera como con el resto de rutas, fetch() sigue la redirección
 * solo y termina recibiendo el HTML de la página de login en vez de JSON,
 * y res.json() truena con un error del navegador que no dice nada útil.
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  if (req.path === "/login" || req.path === "/login-submit") return next();
  if (req.path.startsWith("/api/")) {
    return res.status(401).json({ error: "Tu sesión de administrador expiró. Recarga la página e inicia sesión de nuevo." });
  }
  return res.redirect("/admin/login?next=" + encodeURIComponent(req.originalUrl));
}

router.use(requireAuth);

/** Formulario de login (página propia, no HTTP Basic Auth). */
router.get("/login", (req, res) => {
  res.send(`<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Panel · RelateReady</title>
<style>
  *{box-sizing:border-box;font-family:-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;}
  body{margin:0;background:${BRAND.cream};display:flex;align-items:center;justify-content:center;min-height:100vh;}
  .box{background:#fff;padding:40px;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,0.08);width:320px;text-align:center;}
  .box img{height:44px;margin-bottom:18px;}
  h1{font-size:18px;margin:0 0 6px;color:${BRAND.ink};}
  p{font-size:13px;color:${BRAND.muted};margin:0 0 24px;}
  input{width:100%;padding:11px;margin-bottom:12px;border:1px solid ${BRAND.border};border-radius:8px;font-size:14px;box-sizing:border-box;}
  button{width:100%;padding:12px;background:${BRAND.accent};color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;text-transform:uppercase;letter-spacing:.05em;}
  .error{color:#c0392b;font-size:12.5px;margin-bottom:12px;}
</style></head>
<body>
  <div class="box">
    <img src="/assets/adamantine-logo.png" alt="Adamantine">
    <h1>Panel de Control</h1>
    <p>RelateReady · Índice de Desarrollo y Fortalecimiento Relacional</p>
    ${req.query.error ? '<div class="error">Usuario o contraseña incorrectos.</div>' : ""}
    <form method="POST" action="/admin/login-submit">
      <input type="hidden" name="next" value="${esc(safeNext(req.query.next))}">
      <input type="text" name="username" placeholder="Usuario" required>
      <input type="password" name="password" placeholder="Contraseña" required>
      <button type="submit">Ingresar</button>
    </form>
  </div>
</body></html>`);
});

router.post("/login-submit", express.urlencoded({ extended: true }), (req, res) => {
  const { username, password, next } = req.body;
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect(safeNext(next));
  }
  res.redirect("/admin/login?error=1&next=" + encodeURIComponent(safeNext(next)));
});

router.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/admin/login"));
});

const statusLabel = {
  pending: "Pendiente de pago",
  simulated: "Simulado (prueba)",
  paid: "Pagado",
  free: "Cortesía / código gratis",
};
const statusColor = {
  pending: "#999",
  simulated: BRAND.amber,
  paid: BRAND.green,
  free: BRAND.accent,
};

const followUpLabel = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  sesion_agendada: "Sesión agendada",
  sesion_realizada: "Sesión realizada",
  cliente_mentoring: "Cliente de mentoría",
  sin_interes: "Sin interés",
};
const followUpColor = {
  nuevo: BRAND.accent,
  contactado: BRAND.muted,
  sesion_agendada: "#2E7D32",
  sesion_realizada: "#1565C0",
  cliente_mentoring: BRAND.ink,
  sin_interes: "#999",
};

/** Calcula los KPIs del panel a partir de los datos reales en submissions.
 * Reutilizado tanto por el dashboard clásico (/admin) como por el
 * panel-control (GET /admin/api/kpis). */
function computeKpis() {
  const rows = db.prepare("SELECT payment_status, referral_triggered FROM submissions").all();
  const total = rows.length;
  const paidLike = rows.filter((r) => r.payment_status === "paid" || r.payment_status === "simulated" || r.payment_status === "free");
  const paidCount = rows.filter((r) => r.payment_status === "paid").length;
  const referralCount = rows.filter((r) => r.referral_triggered).length;
  const conversionPct = total ? Math.round((paidLike.length / total) * 100) : 0;
  // Ingresos: aproximado (envíos realmente pagados × precio actual del
  // Informe Extendido). No es exacto si el precio cambió con el tiempo,
  // porque no se guarda el monto real por transacción — ver .env.example
  // EXTENDED_PRICE_CENTS. "simulated" y "free" no suman ingresos reales.
  const revenueApprox = Math.round((paidCount * EXTENDED_PRICE_CENTS) / 100 * 100) / 100;
  return { total, paidCount, paidLikeCount: paidLike.length, conversionPct, referralCount, revenueApprox };
}

function baseStyles() {
  return `
    *{box-sizing:border-box;font-family:-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;}
    body{margin:0;background:${BRAND.cream};color:${BRAND.ink};}
    a{color:inherit;}
    header.topbar{background:${BRAND.ink};color:#fff;padding:16px 24px;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;}
    header.topbar .brand{display:flex;align-items:center;gap:10px;}
    header.topbar .brand img{height:26px;width:auto;display:block;}
    header.topbar .brand span{font-weight:700;font-size:14px;letter-spacing:.02em;}
    header.topbar nav{display:flex;gap:18px;align-items:center;font-size:12.5px;}
    header.topbar nav a{color:${BRAND.light};text-decoration:none;}
    header.topbar nav a:hover{color:#fff;}
    header.topbar nav a.exit{color:#e8b4b4;}
    .container{padding:28px;max-width:1240px;margin:0 auto;}
    .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:26px;}
    .stat-card{background:#fff;border:1px solid ${BRAND.border};border-radius:12px;padding:18px 20px;}
    .stat-num{font-size:26px;font-weight:700;color:${BRAND.accent};}
    .stat-label{font-size:11px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:.06em;margin-top:4px;}
    .card{background:#fff;border:1px solid ${BRAND.border};border-radius:12px;padding:22px 24px;margin-bottom:20px;}
    .filters{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;}
    .filters input,.filters select{padding:9px 12px;border:1px solid ${BRAND.border};border-radius:8px;font-size:13px;background:#fff;color:${BRAND.ink};}
    .btn{padding:9px 18px;background:${BRAND.accent};color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:12.5px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;}
    .btn.ghost{background:transparent;border:1px solid ${BRAND.border};color:${BRAND.ink};}
    .btn.small{padding:6px 12px;font-size:11.5px;}
    table{width:100%;border-collapse:collapse;background:#fff;font-size:13px;}
    th{background:${BRAND.ink};color:${BRAND.light};font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;padding:11px 12px;text-align:left;}
    td{padding:11px 12px;border-bottom:1px solid ${BRAND.border};vertical-align:top;}
    tr:last-child td{border-bottom:none;}
    .muted{color:${BRAND.muted};font-size:11.5px;}
    .badge{color:#fff;font-size:10.5px;padding:4px 10px;border-radius:100px;display:inline-block;}
    select.inline-select{padding:5px 8px;border-radius:6px;font-size:12px;border:1.5px solid #ccc;}
    .inline-form{margin:4px 0 0;}
    .link-btn{background:none;border:none;padding:0;margin-top:4px;color:${BRAND.accent};font-weight:600;font-size:11px;text-decoration:underline;cursor:pointer;}
    .link-btn:hover{color:${BRAND.ink};}
    .table-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid ${BRAND.border};border-radius:12px;}
    .table-scroll table{border-radius:0;min-width:900px;border:none;}
    .chip-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;}
    .chip{background:#fff;border:1px solid ${BRAND.border};color:${BRAND.muted};border-radius:20px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block;}
    .chip.active{background:${BRAND.ink};border-color:${BRAND.ink};color:#fff;}
    @media (max-width:700px){header.topbar{padding:14px 18px;}.container{padding:16px;}.stats{grid-template-columns:repeat(2,1fr);gap:10px;}.filters input{flex:1 1 100%;}}
  `;
}

function topbar({ active } = {}) {
  const link = (href, label, key) => `<a href="${href}" style="${active === key ? "color:#fff;font-weight:700;" : ""}">${label}</a>`;
  return `
    <header class="topbar">
      <div class="brand"><img src="/assets/adamantine-logo.png" alt="Adamantine"><span>RelateReady · Panel</span></div>
      <nav>
        ${link("/admin", "Resultados (básico)", "dashboard")}
        ${link("/panel-control", "Panel de control", "panel")}
        <a href="/admin/logout" class="exit">Cerrar sesión</a>
      </nav>
    </header>`;
}

function scoreAverage(scoreResultJson) {
  try {
    const sr = JSON.parse(scoreResultJson);
    return typeof sr.overallAverage === "number" ? sr.overallAverage : null;
  } catch (e) {
    return null;
  }
}

/** Dashboard básico: tabla de envíos + filtros + chips de seguimiento + KPIs. */
router.get("/", (req, res) => {
  const { status, search, followup } = req.query;
  const kpis = computeKpis();

  let sql = "SELECT * FROM submissions WHERE 1=1";
  const params = [];
  if (status) { sql += " AND payment_status = ?"; params.push(status); }
  if (search) {
    sql += " AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)";
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  sql += " ORDER BY created_at DESC LIMIT 200";
  let rows = db.prepare(sql).all(...params);
  if (followup) rows = rows.filter((r) => r.follow_up_status === followup);

  const baseUrl = `${req.protocol}://${req.get("host")}`;

  const trs = rows.map((r) => {
    const avg = scoreAverage(r.score_result);
    const resultUrl = `${baseUrl}/?sid=${r.id}`;
    let paymentCell = `<span class="badge" style="background:${statusColor[r.payment_status] || "#999"}">${statusLabel[r.payment_status] || r.payment_status}</span>`;
    if (r.payment_status === "pending") {
      paymentCell += `
        <form method="POST" action="/admin/submission/${r.id}/mark-paid" class="inline-form" onsubmit="return confirm('¿Confirmas que viste este pago real (Payphone u otro medio) para ${esc(r.name).replace(/'/g, "")}');">
          <button type="submit" class="link-btn">Marcar como pagado</button>
        </form>`;
    } else {
      paymentCell += `<br><button type="button" class="link-btn" onclick="copyResultLink('${r.id}', this)">Copiar link de resultados</button>`;
    }
    return `
    <tr>
      <td><a href="/admin/submission/${r.id}" style="color:${BRAND.ink};font-weight:600;text-decoration:none;">${esc(r.name)}</a><br><span class="muted">${esc(r.email) || "—"}${r.phone ? " · " + esc(r.phone) : ""}</span></td>
      <td>${r.lang === "en" ? "Inglés" : "Español"}</td>
      <td>${avg !== null ? avg : "—"}</td>
      <td>${paymentCell}<input type="hidden" class="result-url" data-id="${r.id}" value="${resultUrl}"></td>
      <td>${r.referral_triggered ? `<span style="color:${BRAND.clay};font-weight:600;">⚠ Derivación</span>` : "—"}</td>
      <td>
        <form method="POST" action="/admin/submission/${r.id}/follow-up" class="inline-form">
          <select name="status" class="inline-select" onchange="this.form.submit()" style="border-color:${followUpColor[r.follow_up_status] || "#ccc"}">
            ${Object.entries(followUpLabel).map(([k, v]) => `<option value="${k}" ${r.follow_up_status === k ? "selected" : ""}>${v}</option>`).join("")}
          </select>
        </form>
      </td>
      <td>${esc((r.created_at || "").slice(0, 16).replace("T", " "))}</td>
      <td>
        <a href="/admin/submission/${r.id}" class="link-btn" style="text-decoration:none;">Ver detalle</a>
        ${r.payment_status !== "pending" ? `<br><a href="/api/report/extended/${r.id}" target="_blank" class="link-btn" style="text-decoration:none;">Ver informe</a>` : ""}
      </td>
    </tr>`;
  }).join("");

  const followUpFilterChips = ["", ...Object.keys(followUpLabel)].map((k) => {
    const label = k ? followUpLabel[k] : "Todo seguimiento";
    const qs = new URLSearchParams({ ...(search ? { search } : {}), ...(status ? { status } : {}), ...(k ? { followup: k } : {}) });
    const isActive = (followup || "") === k;
    return `<a class="chip ${isActive ? "active" : ""}" href="/admin?${qs.toString()}">${label}</a>`;
  }).join("");

  res.send(`<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>RelateReady — Admin</title>
<style>${baseStyles()}</style></head>
<body>
  ${topbar({ active: "dashboard" })}
  <div class="container">
    <div class="stats">
      <div class="stat-card"><div class="stat-num">${kpis.total}</div><div class="stat-label">Total de envíos</div></div>
      <div class="stat-card"><div class="stat-num">${kpis.conversionPct}%</div><div class="stat-label">Conversión a informe pagado</div></div>
      <div class="stat-card"><div class="stat-num">${kpis.referralCount}</div><div class="stat-label">Protocolo de derivación activado</div></div>
      <div class="stat-card"><div class="stat-num">$${kpis.revenueApprox.toFixed(2)}</div><div class="stat-label">Ingresos aprox. (informes pagados)</div></div>
    </div>

    <p style="margin:0 0 16px;"><a href="/panel-control" class="btn">Abrir panel de control completo →</a></p>

    <form class="filters" method="GET" action="/admin">
      <input type="text" name="search" placeholder="Buscar por nombre, correo o teléfono..." value="${esc(search) || ""}">
      <select name="status">
        <option value="">Todos los estados de pago</option>
        <option value="paid" ${status === "paid" ? "selected" : ""}>Pagado</option>
        <option value="pending" ${status === "pending" ? "selected" : ""}>Pendiente</option>
        <option value="simulated" ${status === "simulated" ? "selected" : ""}>Simulado</option>
        <option value="free" ${status === "free" ? "selected" : ""}>Cortesía / gratis</option>
      </select>
      ${followup ? `<input type="hidden" name="followup" value="${esc(followup)}">` : ""}
      <button type="submit" class="btn">Filtrar</button>
      <a href="/admin/export.csv${status || followup ? "?" + new URLSearchParams({ ...(status ? { status } : {}), ...(followup ? { followup } : {}) }).toString() : ""}" class="btn ghost">Exportar CSV</a>
    </form>

    <div class="chip-row">${followUpFilterChips}</div>

    <div class="table-scroll">
      <table>
        <thead><tr><th>Persona</th><th>Idioma</th><th>Promedio</th><th>Pago</th><th>Derivación</th><th>Seguimiento</th><th>Fecha</th><th></th></tr></thead>
        <tbody>${trs || '<tr><td colspan="8" style="text-align:center;color:#999;padding:30px;">Ningún registro coincide con el filtro.</td></tr>'}</tbody>
      </table>
    </div>
  </div>
  <script>
    function copyResultLink(id, btn) {
      const input = document.querySelector('.result-url[data-id="' + id + '"]');
      if (!input) return;
      navigator.clipboard.writeText(input.value).then(() => {
        const original = btn.textContent;
        btn.textContent = 'Copiado ✓';
        setTimeout(() => { btn.textContent = original; }, 1500);
      }).catch(() => { prompt('Copia este link:', input.value); });
    }
  </script>
</body></html>`);
});

/** Detalle de una persona: contacto, las 8 dimensiones con banda de color,
 * respuestas cualitativas, protocolo de derivación, pago y seguimiento. */
router.get("/submission/:id", (req, res) => {
  const r = db.prepare("SELECT * FROM submissions WHERE id = ?").get(req.params.id);
  if (!r) return res.status(404).send("Registro no encontrado.");

  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const resultUrl = `${baseUrl}/?sid=${r.id}`;

  let scoreResult = {};
  try { scoreResult = JSON.parse(r.score_result); } catch (e) { /* noop */ }
  let qualitativeAnswers = [];
  try { qualitativeAnswers = JSON.parse(r.qualitative_answers || "[]"); } catch (e) { /* noop */ }

  const dimRows = DIMENSIONS.map((d) => {
    const dim = (scoreResult.dimensions || {})[d.code];
    const pct = dim && typeof dim.index === "number" ? dim.index : null;
    const color = dim ? BAND_COLOR[dim.band] || BRAND.muted : BRAND.muted;
    return `
      <div style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:600;margin-bottom:5px;">
          <span>${esc(d.es)} <span class="muted">(${d.code})</span></span>
          <span>${pct !== null ? pct + "%" : "—"}${dim ? ` · <span style="color:${color};">${BAND_LABEL[dim.band]}</span>` : ""}</span>
        </div>
        <div style="background:${BRAND.light};border-radius:20px;height:9px;overflow:hidden;">
          <div style="background:${color};height:100%;width:${pct !== null ? pct : 0}%;"></div>
        </div>
      </div>`;
  }).join("");

  const qualHTML = qualitativeAnswers.filter((a) => a && a.trim()).map((a, i) =>
    `<p style="margin:0 0 12px;font-size:13px;">${esc(a)}</p>`
  ).join("") || '<p class="muted">Sin respuestas cualitativas.</p>';

  res.send(`<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(r.name)} · RelateReady Admin</title>
<style>${baseStyles()}
  .grid2{display:grid;grid-template-columns:1fr 1.1fr;gap:20px;}
  @media (max-width:900px){.grid2{grid-template-columns:1fr;}}
  .info-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid ${BRAND.border};font-size:13px;gap:10px;}
  .info-row:last-child{border-bottom:none;}
  .info-row .label{color:${BRAND.muted};font-weight:600;white-space:nowrap;}
  textarea{width:100%;padding:10px;border:1px solid ${BRAND.border};border-radius:8px;font-size:13px;font-family:inherit;min-height:80px;}
  input[type=text],input[type=email],input[type=tel]{width:100%;padding:8px 10px;border:1px solid ${BRAND.border};border-radius:8px;font-size:13px;font-family:inherit;}
  .score-hero{text-align:center;padding:6px 0 18px;}
  .score-hero .num{font-size:44px;font-weight:700;color:${BRAND.accent};}
  .score-hero .lvl{font-size:13px;font-weight:600;color:${BRAND.ink};margin-top:2px;}
</style></head>
<body>
  ${topbar({ active: "dashboard" })}
  <div class="container">
    <a href="/admin" class="btn ghost small" style="margin-bottom:18px;">← Volver a Resultados</a>
    <div class="grid2">
      <div>
        <div class="card">
          <h2 style="margin:0 0 14px;font-size:15px;">Datos de contacto</h2>
          <form method="POST" action="/admin/submission/${r.id}/contact">
            <label class="muted" style="display:block;margin-bottom:4px;">Nombre</label>
            <input type="text" name="name" value="${esc(r.name)}" style="margin-bottom:10px;">
            <label class="muted" style="display:block;margin-bottom:4px;">Correo</label>
            <input type="email" name="email" value="${esc(r.email) || ""}" style="margin-bottom:10px;">
            <label class="muted" style="display:block;margin-bottom:4px;">Teléfono</label>
            <input type="tel" name="phone" value="${esc(r.phone) || ""}" style="margin-bottom:10px;">
            <button type="submit" class="btn small">Guardar contacto</button>
          </form>
          <div class="info-row" style="margin-top:14px;"><span class="label">Idioma</span><span>${r.lang === "en" ? "Inglés" : "Español"}</span></div>
          <div class="info-row"><span class="label">Género (gramatical)</span><span>${r.gender === "M" ? "Masculino" : r.gender === "F" ? "Femenino" : "No especifica"}</span></div>
          <div class="info-row"><span class="label">Contexto relacional</span><span style="text-align:right;">${esc(r.relationship_context_text)}</span></div>
          <div class="info-row"><span class="label">Fecha</span><span>${esc((r.created_at || "").slice(0, 16).replace("T", " "))}</span></div>
          <div class="info-row"><span class="label">Estado de pago</span><span><span class="badge" style="background:${statusColor[r.payment_status] || "#999"}">${statusLabel[r.payment_status] || r.payment_status}</span></span></div>
          <div class="info-row"><span class="label">Referencia de pago</span><span>${esc(r.payment_reference) || "—"}</span></div>
          <div class="info-row"><span class="label">Protocolo de derivación</span><span>${r.referral_triggered ? `<strong style="color:${BRAND.clay};">Sí, activado</strong>` : "No"}</span></div>
          <div class="info-row"><span class="label">Link de resultados</span><span><button type="button" class="link-btn" onclick="navigator.clipboard.writeText('${resultUrl}').then(()=>{this.textContent='Copiado ✓';setTimeout(()=>this.textContent='Copiar link',1500);})">Copiar link</button></span></div>
          ${r.payment_status !== "pending" ? `<div class="info-row"><span class="label">Informe extendido</span><span><a href="/api/report/extended/${r.id}" target="_blank" class="link-btn" style="text-decoration:none;">Ver / descargar PDF</a></span></div>` : ""}
          ${r.payment_status === "pending" ? `
          <form method="POST" action="/admin/submission/${r.id}/mark-paid" style="margin-top:12px;" onsubmit="return confirm('¿Confirmas que viste este pago real?');">
            <button type="submit" class="btn small">Marcar como pagado</button>
          </form>` : ""}
        </div>

        <div class="card">
          <h2 style="margin:0 0 14px;font-size:15px;">Seguimiento comercial</h2>
          <form method="POST" action="/admin/submission/${r.id}/follow-up">
            <select name="status" class="inline-select" style="width:100%;padding:9px;margin-bottom:10px;">
              ${Object.entries(followUpLabel).map(([k, v]) => `<option value="${k}" ${r.follow_up_status === k ? "selected" : ""}>${v}</option>`).join("")}
            </select>
            <textarea name="notes" placeholder="Notas de seguimiento...">${esc(r.follow_up_notes) || ""}</textarea>
            <button type="submit" class="btn small" style="margin-top:10px;">Guardar</button>
          </form>
        </div>
      </div>

      <div>
        <div class="card">
          <div class="score-hero">
            <div class="num">${typeof scoreResult.overallAverage === "number" ? scoreResult.overallAverage : "—"}</div>
            <div class="lvl">Promedio general · 8 dimensiones</div>
          </div>
          <h2 style="margin:0 0 14px;font-size:14px;">Las 8 dimensiones</h2>
          ${dimRows}
        </div>
        <div class="card">
          <h2 style="margin:0 0 14px;font-size:15px;">Respuestas cualitativas</h2>
          ${qualHTML}
        </div>
      </div>
    </div>
  </div>
</body></html>`);
});

router.post("/submission/:id/follow-up", express.urlencoded({ extended: true }), (req, res) => {
  db.prepare("UPDATE submissions SET follow_up_status = ?, follow_up_notes = ? WHERE id = ?")
    .run(req.body.status || "nuevo", req.body.notes || null, req.params.id);
  const backTo = req.get("Referer") && req.get("Referer").includes(`/submission/${req.params.id}`)
    ? `/admin/submission/${req.params.id}`
    : "/admin";
  res.redirect(backTo);
});

router.post("/submission/:id/contact", express.urlencoded({ extended: true }), (req, res) => {
  const name = (req.body.name || "").trim();
  const email = (req.body.email || "").trim() || null;
  const phone = (req.body.phone || "").trim() || null;
  if (name) {
    db.prepare("UPDATE submissions SET name = ?, email = ?, phone = ? WHERE id = ?").run(name, email, phone, req.params.id);
  }
  res.redirect(`/admin/submission/${req.params.id}`);
});

/**
 * Marca manualmente un envío como pagado, sin pasar por Payphone — mismo
 * respaldo manual que ya existe en el panel de SQ Assessment, para cuando
 * Francisco confirma el pago por otro medio (transferencia, en persona, etc.)
 * y quiere darle acceso al Informe Extendido sin cobrar de nuevo.
 */
router.post("/submission/:id/mark-paid", (req, res) => {
  const sub = db.prepare("SELECT payment_status FROM submissions WHERE id = ?").get(req.params.id);
  if (sub && sub.payment_status === "pending") {
    db.prepare("UPDATE submissions SET payment_status = 'paid', payment_reference = 'CONFIRMADO_MANUAL_ADMIN' WHERE id = ?").run(req.params.id);
  }
  const backTo = req.get("Referer") && req.get("Referer").includes(`/submission/${req.params.id}`)
    ? `/admin/submission/${req.params.id}`
    : "/admin";
  res.redirect(backTo);
});

/** Exporta todos los envíos (o los que coincidan con el filtro) como CSV. */
router.get("/export.csv", (req, res) => {
  const { status, followup } = req.query;
  let sql = "SELECT * FROM submissions WHERE 1=1";
  const params = [];
  if (status) { sql += " AND payment_status = ?"; params.push(status); }
  sql += " ORDER BY created_at DESC";
  let rows = db.prepare(sql).all(...params);
  if (followup) rows = rows.filter((r) => r.follow_up_status === followup);

  const headers = ["Nombre", "Correo", "Teléfono", "Idioma", "Promedio", "Estado de pago", "Derivación", "Seguimiento", "Notas", "Fecha"];
  const csvEscape = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const lines = [headers.join(",")];
  rows.forEach((r) => {
    lines.push([
      r.name, r.email, r.phone, r.lang === "en" ? "Inglés" : "Español",
      scoreAverage(r.score_result), statusLabel[r.payment_status] || r.payment_status,
      r.referral_triggered ? "Sí" : "No",
      followUpLabel[r.follow_up_status] || r.follow_up_status, r.follow_up_notes,
      r.created_at,
    ].map(csvEscape).join(","));
  });

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="relateready-resultados-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send("﻿" + lines.join("\n"));
});

// ═══════════════════════ API JSON para /panel-control ═══════════════════════
// panel.html (el panel de control completo) consume estos endpoints con
// fetch() en vez de tener los datos escritos a mano en el HTML — igual que
// el panel de referencia de SQ Assessment.

function serializeSubmission(r) {
  let scoreResult = {};
  try { scoreResult = JSON.parse(r.score_result); } catch (e) { /* noop */ }
  let qualitativeAnswers = [];
  try { qualitativeAnswers = JSON.parse(r.qualitative_answers || "[]"); } catch (e) { /* noop */ }
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    lang: r.lang,
    gender: r.gender,
    relationship_context_text: r.relationship_context_text,
    overall_average: typeof scoreResult.overallAverage === "number" ? scoreResult.overallAverage : null,
    dimensions: scoreResult.dimensions || {},
    top_strengths: scoreResult.topStrengths || [],
    top_development_areas: scoreResult.topDevelopmentAreas || [],
    qualitative_answers: qualitativeAnswers,
    referral_triggered: !!r.referral_triggered,
    payment_status: r.payment_status,
    payment_reference: r.payment_reference,
    extended_generated_at: r.extended_generated_at,
    follow_up_status: r.follow_up_status,
    follow_up_notes: r.follow_up_notes,
    created_at: r.created_at,
  };
}

/** KPIs calculados con datos reales — tarjetas del inicio de /panel-control. */
router.get("/api/kpis", (req, res) => {
  res.json(computeKpis());
});

/** Todos los envíos, en vivo desde la base de datos. */
router.get("/api/results", (req, res) => {
  const rows = db.prepare("SELECT * FROM submissions ORDER BY created_at DESC LIMIT 5000").all();
  res.json(rows.map(serializeSubmission));
});

router.get("/api/results/:id", (req, res) => {
  const r = db.prepare("SELECT * FROM submissions WHERE id = ?").get(req.params.id);
  if (!r) return res.status(404).json({ error: "Registro no encontrado." });
  res.json(serializeSubmission(r));
});

router.patch("/api/results/:id/follow-up", express.json(), (req, res) => {
  const existing = db.prepare("SELECT * FROM submissions WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Registro no encontrado." });
  const { status, notes } = req.body || {};
  db.prepare("UPDATE submissions SET follow_up_status = ?, follow_up_notes = ? WHERE id = ?").run(
    status !== undefined ? status : existing.follow_up_status,
    notes !== undefined ? notes : existing.follow_up_notes,
    req.params.id
  );
  res.json({ ok: true, submission: serializeSubmission(db.prepare("SELECT * FROM submissions WHERE id = ?").get(req.params.id)) });
});

router.patch("/api/results/:id/contact", express.json(), (req, res) => {
  const existing = db.prepare("SELECT * FROM submissions WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Registro no encontrado." });
  const { name, email, phone } = req.body || {};
  const cleanName = typeof name === "string" && name.trim() ? name.trim() : existing.name;
  const cleanEmail = email !== undefined ? (String(email).trim() || null) : existing.email;
  const cleanPhone = phone !== undefined ? (String(phone).trim() || null) : existing.phone;
  db.prepare("UPDATE submissions SET name = ?, email = ?, phone = ? WHERE id = ?").run(cleanName, cleanEmail, cleanPhone, req.params.id);
  res.json({ ok: true, submission: serializeSubmission(db.prepare("SELECT * FROM submissions WHERE id = ?").get(req.params.id)) });
});

router.post("/api/results/:id/mark-paid", (req, res) => {
  const existing = db.prepare("SELECT payment_status FROM submissions WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Registro no encontrado." });
  if (existing.payment_status === "pending") {
    db.prepare("UPDATE submissions SET payment_status = 'paid', payment_reference = 'CONFIRMADO_MANUAL_ADMIN' WHERE id = ?").run(req.params.id);
  }
  res.json({ ok: true, submission: serializeSubmission(db.prepare("SELECT * FROM submissions WHERE id = ?").get(req.params.id)) });
});

// El panel de control completo (/panel-control, ver server.js) reutiliza
// este mismo login: se exporta requireAuth para que server.js proteja esa
// ruta con la misma sesión de administrador.
module.exports = router;
module.exports.requireAuth = requireAuth;
