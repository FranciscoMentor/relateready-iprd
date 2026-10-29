// routes/sales.js — API de la pestaña "Ventas" de /panel-control.
// Se monta en /admin/api/ventas (detrás del login de administrador, ver routes/admin.js).
const express = require("express");
const router = express.Router();
const sales = require("../services/sales");

// Totales, embudo por campaña y lista de compras.
router.get("/", (req, res) => {
  res.json({ totals: sales.totals(), campaigns: sales.byCampaign(), sales: sales.salesList() });
});

// Gasto total en anuncios de una campaña, capturado a mano: { campaign, amountUsd }.
router.post("/gasto", express.json(), (req, res) => {
  const b = req.body || {};
  try {
    sales.setSpend(b.campaign, Number(b.amountUsd) * 100);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Registra un reembolso ya hecho en Payphone: { } sobre el id del pago.
router.post("/reembolso/:paymentId", (req, res) => {
  const r = sales.refundPayment(req.params.paymentId);
  if (!r.ok) return res.status(r.reason === "not_found" ? 404 : 400).json({ error: r.reason === "not_found" ? "Pago no encontrado." : "Ese pago no está aprobado (o ya fue reembolsado)." });
  res.json({ ok: true });
});

module.exports = router;
