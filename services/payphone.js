// Integración de pago — Payphone (Ecuador), método "Botón de pago por
// redirección" (Prepare + Confirm). Ver https://docs.payphone.app/boton-de-pago-por-redireccion
//
// ESTADO: si PAYPHONE_TOKEN / PAYPHONE_STORE_ID no están configurados, el
// flujo queda en modo simulado (usa /api/payment/simulate/:id, ver routes/api.js)
// — así se puede probar el resto de la app sin credenciales de comercio.
// En cuanto ambas variables tienen valor, se activa el flujo real de abajo.

const PAYPHONE_ENABLED = Boolean(process.env.PAYPHONE_TOKEN && process.env.PAYPHONE_STORE_ID);

const PREPARE_URL = "https://pay.payphonetodoesposible.com/api/button/Prepare";
const CONFIRM_URL = "https://pay.payphonetodoesposible.com/api/button/V2/Confirm";

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.PAYPHONE_TOKEN}`,
    "Content-Type": "application/json",
  };
}

/**
 * Prepara una transacción y devuelve la URL a la que hay que abrir una
 * pestaña nueva para que la persona pague.
 * @param {{amountCents:number, clientTransactionId:string, reference:string, responseUrl:string, email?:string}} params
 */
async function preparePayment({ amountCents, clientTransactionId, reference, responseUrl, email }) {
  if (!PAYPHONE_ENABLED) {
    throw new Error("Payphone no está configurado (faltan PAYPHONE_TOKEN / PAYPHONE_STORE_ID).");
  }
  const body = {
    amount: amountCents,
    amountWithoutTax: amountCents,
    amountWithTax: 0,
    tax: 0,
    service: 0,
    tip: 0,
    clientTransactionId,
    storeId: process.env.PAYPHONE_STORE_ID,
    currency: "USD",
    reference,
    responseUrl,
    cancellationUrl: responseUrl,
    ...(email ? { email } : {}),
  };
  const res = await fetch(PREPARE_URL, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Payphone Prepare falló (${res.status}): ${data.message || JSON.stringify(data)}`);
  }
  return { paymentId: data.paymentId, payWithCard: data.payWithCard, payWithPayPhone: data.payWithPayPhone };
}

/**
 * Confirma una transacción ya pagada (llamada al volver de Payphone con
 * los parámetros `id` y `clientTransactionId` que Payphone añade a responseUrl).
 */
async function confirmPayment({ id, clientTransactionId }) {
  if (!PAYPHONE_ENABLED) {
    return { approved: true, simulated: true, reference: clientTransactionId || `SIM-${Date.now()}` };
  }
  const res = await fetch(CONFIRM_URL, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ id: Number(id), clientTxId: clientTransactionId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Payphone Confirm falló (${res.status}): ${data.message || JSON.stringify(data)}`);
  }
  return {
    approved: data.statusCode === 3,
    simulated: false,
    reference: data.authorizationCode || String(data.transactionId || ""),
    raw: data,
  };
}

module.exports = { preparePayment, confirmPayment, PAYPHONE_ENABLED };
