// services/sales.js
//
// Ventas del Informe Extendido para el panel (pestaña "Ventas" y KPIs del inicio).
//
// Tres orígenes que NUNCA se mezclan:
//   - "payphone": compra real, con un pago aprobado y verificado en la tabla `payments`.
//     Es lo único que suma ingresos y lo único que cuenta como "compra" del embudo.
//   - "code":     informe gratis con un código (payment_status = free, CODE:<código>).
//   - "manual":   marcado como pagado a mano en el panel (CONFIRMADO_MANUAL_ADMIN):
//                 no hay pago verificado ni monto, por eso no suma ingresos.
// Además: "legacy" (pagado antes de existir la tabla payments, con referencia de
// Payphone) y "simulated" (modo de prueba sin Payphone).
const db = require("../db/init");

const NO_UTM = "(directo o sin utm)";
const META_NO_UTM = "(anuncio de Meta sin utm)";

function campaignKey(r) {
  return r.utm_campaign || (r.from_meta_ad ? META_NO_UTM : NO_UTM);
}

/** Origen del desbloqueo de un envío. `hasApproved`: tiene un pago aprobado en payments. */
function saleSourceOf(r, hasApproved) {
  if (hasApproved) return "payphone";
  const st = r.payment_status;
  if (st === "free") return "code";
  if (st === "simulated") return "simulated";
  if (st === "paid") return r.payment_reference === "CONFIRMADO_MANUAL_ADMIN" ? "manual" : "legacy";
  return null; // pending
}

function approvedSubmissionIds() {
  return new Set(db.prepare("SELECT DISTINCT submission_id FROM payments WHERE status = 'approved'").all().map((x) => x.submission_id));
}

/** Totales para las tarjetas (inicio y pestaña Ventas). */
function totals() {
  const approved = approvedSubmissionIds();
  const subs = db.prepare("SELECT id, payment_status, payment_reference FROM submissions").all();
  const t = { tests: subs.length, payphone: 0, code: 0, manual: 0, legacy: 0, simulated: 0, pending: 0 };
  for (const s of subs) {
    const src = saleSourceOf(s, approved.has(s.id));
    if (src) t[src]++; else t.pending++;
  }
  const rev = db.prepare("SELECT COALESCE(SUM(amount_cents),0) c, COUNT(*) n FROM payments WHERE status = 'approved' AND currency = 'USD'").get();
  const started = db.prepare("SELECT COUNT(DISTINCT submission_id) n FROM payments").get().n;
  return { ...t, revenueCents: rev.c, payphonePayments: rev.n, checkoutStarted: started };
}

/** Embudo por campaña (utm_campaign), con el gasto capturado a mano y el costo por compra. */
function byCampaign() {
  const subs = db
    .prepare("SELECT id, created_at, utm_campaign, from_meta_ad, payment_status, payment_reference, summary_viewed_at, unlock_clicked_at, code_redeemed_at FROM submissions")
    .all();
  const pays = db.prepare("SELECT submission_id, status, amount_cents, currency FROM payments").all();
  const paysBySub = new Map();
  for (const p of pays) { (paysBySub.get(p.submission_id) || paysBySub.set(p.submission_id, []).get(p.submission_id)).push(p); }
  const spend = new Map(db.prepare("SELECT campaign, amount_cents FROM ad_spend").all().map((x) => [x.campaign, x.amount_cents]));

  const groups = new Map();
  const g = (k) => groups.get(k) || groups.set(k, { campaign: k, tests: 0, summaryViewed: 0, checkoutStarted: 0, purchases: 0, revenueCents: 0, codes: 0, manual: 0 }).get(k);
  for (const s of subs) {
    const row = g(campaignKey(s));
    row.tests++;
    if (s.summary_viewed_at) row.summaryViewed++;
    const ps = paysBySub.get(s.id) || [];
    if (ps.length) row.checkoutStarted++;
    const ok = ps.filter((p) => p.status === "approved");
    if (ok.length) { row.purchases++; row.revenueCents += ok.filter((p) => p.currency === "USD").reduce((a, p) => a + p.amount_cents, 0); }
    const src = saleSourceOf(s, ok.length > 0);
    if (src === "code") row.codes++;
    if (src === "manual") row.manual++;
  }
  // Campañas con gasto pero sin envíos todavía también aparecen.
  for (const k of spend.keys()) g(k);
  const out = [...groups.values()].map((r) => {
    const spendCents = spend.get(r.campaign) || 0;
    return {
      ...r,
      spendCents,
      costPerPurchaseCents: r.purchases && spendCents ? Math.round(spendCents / r.purchases) : null,
      roas: spendCents ? Math.round((r.revenueCents / spendCents) * 100) / 100 : null,
    };
  });
  out.sort((a, b) => b.tests - a.tests);
  return out;
}

/** Lista de compras (reales de Payphone + marcas manuales + anteriores) con su origen. */
function salesList() {
  const rows = db
    .prepare(
      `SELECT s.id, s.name, s.email, s.lang, s.created_at, s.payment_status, s.payment_reference, s.utm_campaign, s.from_meta_ad,
              s.book_downloaded_at, s.book_download_count, s.extended_email_status
         FROM submissions s WHERE s.payment_status = 'paid' ORDER BY datetime(s.created_at) DESC`
    )
    .all();
  const payBySub = new Map();
  for (const p of db.prepare("SELECT * FROM payments WHERE status = 'approved' ORDER BY id ASC").all()) payBySub.set(p.submission_id, p);
  const out = rows.map((s) => {
    const p = payBySub.get(s.id);
    const hasApproved = !!(p && p.status === "approved");
    return {
      id: s.id, name: s.name, email: s.email, campaign: campaignKey(s),
      source: saleSourceOf(s, hasApproved),
      paymentId: hasApproved ? p.id : null,
      amountCents: hasApproved ? p.amount_cents : null,
      currency: hasApproved ? p.currency : null,
      date: hasApproved ? (p.confirmed_at || p.created_at) : s.created_at,
      transactionId: hasApproved ? p.payphone_id : null,
      authorizationCode: hasApproved ? p.authorization_code : null,
      bookDownloads: s.book_download_count || 0,
      emailStatus: s.extended_email_status || null,
    };
  });
  return out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function setSpend(campaign, amountCents) {
  const key = String(campaign || "").trim().slice(0, 200);
  if (!key) throw new Error("Falta la campaña.");
  const cents = Math.round(Number(amountCents));
  if (!Number.isFinite(cents) || cents < 0 || cents > 100000000) throw new Error("Monto no válido.");
  db.prepare("INSERT INTO ad_spend (campaign, amount_cents, updated_at) VALUES (?,?,?) ON CONFLICT(campaign) DO UPDATE SET amount_cents = excluded.amount_cents, updated_at = excluded.updated_at")
    .run(key, cents, new Date().toISOString());
}

module.exports = { campaignKey, saleSourceOf, totals, byCampaign, salesList, setSpend };
