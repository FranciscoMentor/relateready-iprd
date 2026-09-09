// services/graphAuth.js
//
// Obtención y caché del token de acceso a Microsoft Graph (flujo de
// credenciales de cliente / application permissions), compartida por todos
// los servicios que hablan con Graph desde el servidor:
//   - services/graphMail.js   (envío de correo — permiso Mail.Send)
//   - services/graphExcel.js  (lectura de la tabla de referidos — permiso
//                               Files.Read.All)
// Ambos usan el MISMO registro de app en Azure AD ("RelateReady - Correo"),
// solo que ese registro necesita tener ambos permisos de API otorgados con
// consentimiento de administrador. Extraído a un archivo aparte para no
// duplicar la lógica de token (antes vivía solo dentro de graphMail.js).
//
// Configuración (Render → tu servicio → Environment) — las mismas 3 de
// siempre, ver graphMail.js para el detalle de cada una:
//   GRAPH_TENANT_ID / GRAPH_CLIENT_ID / GRAPH_CLIENT_SECRET

const TENANT_ID = process.env.GRAPH_TENANT_ID;
const CLIENT_ID = process.env.GRAPH_CLIENT_ID;
const CLIENT_SECRET = process.env.GRAPH_CLIENT_SECRET;

const GRAPH_AUTH_CONFIGURED = Boolean(TENANT_ID && CLIENT_ID && CLIENT_SECRET);

let cachedToken = null; // { accessToken, expiresAt }

async function getAccessToken() {
  if (!GRAPH_AUTH_CONFIGURED) {
    throw new Error("GRAPH_TENANT_ID/GRAPH_CLIENT_ID/GRAPH_CLIENT_SECRET no están configurados.");
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }
  const url = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`No se pudo obtener token de Microsoft Graph (${resp.status}): ${text}`);
  }
  const data = await resp.json();
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
  return cachedToken.accessToken;
}

module.exports = { getAccessToken, GRAPH_AUTH_CONFIGURED };
