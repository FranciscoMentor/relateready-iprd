// Integración de pago — Payphone (Ecuador).
//
// ESTADO ACTUAL: modo simulado. Mientras PAYPHONE_TOKEN / PAYPHONE_STORE_ID
// no estén configurados en las variables de entorno, confirmPayment()
// aprueba la compra sin cobrar de verdad — así se puede probar el flujo
// completo del Informe Extendido antes de tener las credenciales de comercio.
//
// --- Activar Payphone real (cuando tengas las credenciales) ---
// 1. Crea el link de pago desde el frontend usando la API "PayWithCard" /
//    "API Link" de Payphone (ver su documentación de comercio) al monto de
//    IPRD_estrategia_mercado_y_precio.docx ($24.99 Informe Extendido).
// 2. Al volver de Payphone con un `id` y `clientTransactionId`, llama a
//    confirmPayment(id, clientTransactionId) — reemplaza el cuerpo de esta
//    función por la llamada real a POST https://pay.payphonetodoesposible.com/api/button/V2/Confirm
//    con el header Authorization: Bearer ${PAYPHONE_TOKEN}.
// 3. Verifica que la respuesta tenga statusCode === 3 (aprobada) antes de
//    desbloquear la generación del Informe Extendido.

const PAYPHONE_ENABLED = Boolean(process.env.PAYPHONE_TOKEN && process.env.PAYPHONE_STORE_ID);

async function confirmPayment({ id, clientTransactionId }) {
  if (!PAYPHONE_ENABLED) {
    return { approved: true, simulated: true, reference: clientTransactionId || `SIM-${Date.now()}` };
  }
  // TODO: reemplazar por la llamada real a Payphone cuando existan credenciales.
  // const res = await fetch("https://pay.payphonetodoesposible.com/api/button/V2/Confirm", {
  //   method: "POST",
  //   headers: { Authorization: `Bearer ${process.env.PAYPHONE_TOKEN}`, "Content-Type": "application/json" },
  //   body: JSON.stringify({ id, clientTxId: clientTransactionId }),
  // });
  // const data = await res.json();
  // return { approved: data.statusCode === 3, simulated: false, raw: data };
  throw new Error("Payphone real no implementado todavía — completa services/payphone.js");
}

module.exports = { confirmPayment, PAYPHONE_ENABLED };
