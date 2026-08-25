const express = require("express");
const router = express.Router();
const db = require("../db/init");

function basicAuth(req, res, next) {
  const user = process.env.ADMIN_USER || "admin";
  const pass = process.env.ADMIN_PASSWORD || "admin";
  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const [u, p] = Buffer.from(encoded, "base64").toString().split(":");
    if (u === user && p === pass) return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="RelateReady Admin"');
  return res.status(401).send("Autenticación requerida.");
}

router.use(basicAuth);

router.get("/", (req, res) => {
  const rows = db
    .prepare("SELECT id, created_at, name, lang, payment_status, referral_triggered FROM submissions ORDER BY created_at DESC LIMIT 200")
    .all();

  const trs = rows
    .map(
      (r) => `
    <tr>
      <td>${r.created_at.slice(0, 16).replace("T", " ")}</td>
      <td>${escapeHtml(r.name)}</td>
      <td>${r.lang}</td>
      <td>${r.payment_status}${r.referral_triggered ? ' <span style="color:#9C3B2E">⚠ derivación</span>' : ""}</td>
      <td>
        <a href="/api/report/preview/${r.id}" target="_blank">Preview</a>
        ${r.payment_status !== "pending" ? ` · <a href="/api/report/extended/${r.id}" target="_blank">Extendido</a>` : ""}
      </td>
    </tr>`
    )
    .join("");

  res.send(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>RelateReady — Admin</title>
<style>
  body{font-family:Arial,sans-serif;background:#F4F0E9;color:#2A2A28;padding:32px;}
  h1{color:#B5732A;}
  table{border-collapse:collapse;width:100%;background:#fff;}
  th,td{border:1px solid #DDD6CE;padding:8px 10px;font-size:14px;text-align:left;}
  th{background:#B5732A;color:#fff;}
  tr:nth-child(even){background:#ECE4D6;}
</style></head>
<body>
  <h1>RelateReady — Panel admin</h1>
  <p>${rows.length} envíos más recientes.</p>
  <table>
    <thead><tr><th>Fecha</th><th>Nombre</th><th>Idioma</th><th>Pago</th><th>Informes</th></tr></thead>
    <tbody>${trs}</tbody>
  </table>
</body></html>`);
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

module.exports = router;
