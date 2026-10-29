// services/payments.js
//
// Registro y confirmación segura de los pagos con Payphone.
//
// Reglas (ver también services/payphone.js):
//  - Cada intento de pago es un renglón de la tabla `payments`, con su propio
//    clientTransactionId aleatorio ligado a UN solo informe (submission_id).
//  - El informe NUNCA se desbloquea por lo que diga el navegador: solo cuando
//    el servidor confirma la transacción con Payphone y comprueba que (a) el
//    clientTransactionId pertenece a este informe, (b) el id de transacción
//    coincide, (c) el estado es aprobado (statusCode 3) y (d) el monto y la
//    moneda son los del intento.
//  - Es idempotente: confirmar dos veces (recarga, doble clic, reintento) no
//    duplica el pago, el desbloqueo ni el correo.
const crypto = require("crypto");
const db = require("../db/init");
const { confirmPayment } = require("./payphone");

// clientTransactionId: 32 caracteres hexadecimales (el máximo de Payphone es 50).
function newClientTxId() {
  return crypto.randomBytes(16).toString("hex");
}

function createPayment(submissionId, amountCents, currency = "USD") {
  const clientTxId = newClientTxId();
  db.prepare(
    "INSERT INTO payments (submission_id, client_tx_id, amount_cents, currency, status, created_at) VALUES (?,?,?,?, 'created', ?)"
  ).run(submissionId, clientTxId, amountCents, currency, new Date().toISOString());
  return clientTxId;
}

function paymentByClientTx(clientTxId) {
  return db.prepare("SELECT * FROM payments WHERE client_tx_id = ?").get(String(clientTxId || ""));
}

/** Último pago aprobado (real, de Payphone) de un informe, o undefined. */
function approvedPaymentFor(submissionId) {
  return db
    .prepare("SELECT * FROM payments WHERE submission_id = ? AND status = 'approved' ORDER BY id DESC LIMIT 1")
    .get(submissionId);
}

/**
 * Confirma con Payphone el pago `clientTransactionId`/`payphoneId` para el
 * informe `sub`. Devuelve { ok, approved, newlyApproved, reason?, payment? }.
 *  - ok=false: la petición no es válida (el pago no existe o no es de este informe).
 *  - approved=true: el pago está aprobado y verificado (ahora o antes).
 *  - newlyApproved=true: es la PRIMERA vez que se aprueba (úsalo para disparar el correo).
 */
async function confirmForSubmission(sub, { payphoneId, clientTransactionId }) {
  const payment = paymentByClientTx(clientTransactionId);
  if (!payment || payment.submission_id !== sub.id) {
    return { ok: false, approved: false, reason: "payment_not_found" };
  }
  if (payment.status === "approved") {
    // Ya confirmado antes: nada que repetir (y no se vuelve a llamar a Payphone).
    return { ok: true, approved: true, newlyApproved: false, payment };
  }

  const result = await confirmPayment({ id: payphoneId, clientTransactionId: payment.client_tx_id });
  const raw = result.raw || {};
  const sameTx = result.simulated || String(raw.transactionId) === String(payphoneId);
  const amountOk = result.simulated || Number(raw.amount) === Number(payment.amount_cents);
  const currencyOk = result.simulated || !raw.currency || String(raw.currency).toUpperCase() === payment.currency;
  const approved = !!result.approved && sameTx && amountOk && currencyOk;

  const now = new Date().toISOString();
  if (!approved) {
    const status = Number(raw.statusCode) === 2 ? "canceled" : "failed";
    db.prepare("UPDATE payments SET status = ?, status_code = ?, payphone_id = ?, confirmed_at = ? WHERE id = ? AND status != 'approved'").run(
      status, raw.statusCode === undefined ? null : Number(raw.statusCode), String(payphoneId || ""), now, payment.id
    );
    if (result.approved && !(sameTx && amountOk && currencyOk)) {
      console.error(`[payments] Pago ${payment.client_tx_id} aprobado por Payphone pero NO coincide (id/monto/moneda): se rechaza.`);
    }
    return { ok: true, approved: false, reason: status };
  }

  // Aprobación atómica: solo una petición puede pasar de "no aprobado" a "approved".
  let newly = false;
  db.transaction(() => {
    const upd = db
      .prepare(
        "UPDATE payments SET status = 'approved', payphone_id = ?, authorization_code = ?, card_brand = ?, status_code = 3, confirmed_at = ? WHERE id = ? AND status != 'approved'"
      )
      .run(String(payphoneId), result.reference || null, raw.cardBrand ? String(raw.cardBrand).slice(0, 30) : null, now, payment.id);
    newly = upd.changes === 1;
    if (newly) {
      // Solo desbloquea si seguía pendiente (no pisa un código gratis ya canjeado).
      db.prepare("UPDATE submissions SET payment_status = 'paid', payment_reference = ? WHERE id = ? AND payment_status = 'pending'").run(
        result.reference || payment.client_tx_id, sub.id
      );
    }
  })();
  return { ok: true, approved: true, newlyApproved: newly, payment: paymentByClientTx(payment.client_tx_id) };
}

module.exports = { createPayment, paymentByClientTx, approvedPaymentFor, confirmForSubmission };
