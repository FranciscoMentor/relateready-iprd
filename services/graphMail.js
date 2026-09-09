// services/graphMail.js
//
// Envío de correo transaccional vía Microsoft Graph, usando la aplicación
// "RelateReady - Correo" registrada en Azure AD (permiso de aplicación
// Mail.Send, con consentimiento de administrador ya otorgado para el tenant
// ADAMANTINE MIND). Usa el flujo de credenciales de cliente (client
// credentials) — no requiere ninguna sesión de usuario iniciada, por eso
// sirve para envíos automáticos desde el servidor (a diferencia del
// calendario de /panel-control, que sí usa un flujo de usuario con MSAL en
// el navegador — ver la nota en .env.example).
//
// Configuración (Render → tu servicio → Environment):
//   GRAPH_TENANT_ID      — Directory (tenant) ID del registro "RelateReady - Correo"
//   GRAPH_CLIENT_ID      — Application (client) ID del mismo registro
//   GRAPH_CLIENT_SECRET  — el "Value" del client secret creado en Certificates & secrets
//   GRAPH_SENDER_MAILBOX — el buzón que aparece como remitente (debe tener
//                           licencia de Exchange Online), ej.
//                           franciscorosero@adamantinehealing.onmicrosoft.com
//
// Si falta cualquiera de esas cuatro variables, el correo automático queda
// deshabilitado solo (GRAPH_MAIL_ENABLED = false): las funciones de este
// archivo no hacen nada (y lo dejan registrado en consola) en vez de fallar
// — mismo patrón que ANTHROPIC_API_KEY y Payphone (ver README.md), para que
// el resto de la app siga funcionando igual mientras no esté configurado.

const { getAccessToken, GRAPH_AUTH_CONFIGURED } = require("./graphAuth");

const SENDER_MAILBOX = process.env.GRAPH_SENDER_MAILBOX;

const GRAPH_MAIL_ENABLED = Boolean(GRAPH_AUTH_CONFIGURED && SENDER_MAILBOX);

if (!GRAPH_MAIL_ENABLED) {
  console.log(
    "[graphMail] GRAPH_TENANT_ID/GRAPH_CLIENT_ID/GRAPH_CLIENT_SECRET/GRAPH_SENDER_MAILBOX no están " +
      "configurados todavía — el correo automático queda deshabilitado (no rompe nada más)."
  );
}

// sendMail({ to, subject, html, attachments })
// attachments: [{ filename, contentBytes: Buffer, contentType }]
async function sendMail({ to, subject, html, attachments = [] }) {
  if (!GRAPH_MAIL_ENABLED) {
    console.log(`[graphMail] (deshabilitado) no se envió correo a ${to} — asunto: "${subject}"`);
    return { sent: false, reason: "disabled" };
  }
  if (!to) {
    console.warn("[graphMail] sendMail llamado sin destinatario — se omite.");
    return { sent: false, reason: "no-recipient" };
  }
  try {
    const accessToken = await getAccessToken();
    const message = {
      subject,
      body: { contentType: "HTML", content: html },
      toRecipients: [{ emailAddress: { address: to } }],
    };
    if (attachments.length) {
      message.attachments = attachments.map((a) => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: a.filename,
        contentType: a.contentType || "application/octet-stream",
        contentBytes: Buffer.isBuffer(a.contentBytes) ? a.contentBytes.toString("base64") : a.contentBytes,
      }));
    }
    const resp = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(SENDER_MAILBOX)}/sendMail`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, saveToSentItems: true }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`Graph sendMail respondió ${resp.status}: ${text}`);
    }
    return { sent: true };
  } catch (err) {
    console.error(`[graphMail] Error enviando correo a ${to} —`, err.message);
    return { sent: false, reason: "error", error: err.message };
  }
}

module.exports = { sendMail, GRAPH_MAIL_ENABLED };
