// services/graphExcel.js
//
// Lectura (solo lectura) de las filas de la tabla de Excel del programa de
// referidos (Hueco 2) vía Microsoft Graph — el mismo archivo
// "RelateReady - Referidos.xlsx" que ya alimenta el flujo de Power Automate
// (formulario → correos → esta misma tabla). RelateReady NUNCA escribe en
// ese archivo, solo lo lee para mostrarlo en el panel de control; el flujo
// de Power Automate sigue siendo la única fuente que agrega filas.
//
// Usa la MISMA app de Azure AD que services/graphMail.js ("RelateReady -
// Correo"), así que además del permiso Mail.Send que ya tiene, esa app
// necesita un permiso de aplicación adicional con consentimiento de
// administrador:
//   Files.Read.All  (Microsoft Graph, tipo Application)
//
// Configuración (Render → tu servicio → Environment):
//   GRAPH_REFERRALS_OWNER      — buzón/OneDrive donde vive el archivo Excel.
//                                 Por defecto usa GRAPH_SENDER_MAILBOX (el
//                                 mismo valor que el correo saliente), que es
//                                 lo normal si Francisco es quien creó el
//                                 formulario y el archivo. Solo hace falta
//                                 configurarla aparte si el archivo vive en
//                                 el OneDrive de OTRA cuenta.
//   GRAPH_REFERRALS_FILE_PATH  — ruta del archivo dentro de ese OneDrive.
//                                 Por defecto "/RelateReady - Referidos.xlsx"
//                                 (raíz del OneDrive — ajústala si lo moviste
//                                 a una subcarpeta).
//   GRAPH_REFERRALS_TABLE      — nombre de la tabla dentro del archivo.
//                                 Por defecto "Referidos".
//
// Si falta el buzón (ni GRAPH_REFERRALS_OWNER ni GRAPH_SENDER_MAILBOX están
// configurados), esta función queda deshabilitada igual que graphMail — el
// panel simplemente muestra un aviso en vez de romperse.

const { getAccessToken, GRAPH_AUTH_CONFIGURED } = require("./graphAuth");

const OWNER_MAILBOX = process.env.GRAPH_REFERRALS_OWNER || process.env.GRAPH_SENDER_MAILBOX;
const FILE_PATH = process.env.GRAPH_REFERRALS_FILE_PATH || "/RelateReady - Referidos.xlsx";
const TABLE_NAME = process.env.GRAPH_REFERRALS_TABLE || "Referidos";

const GRAPH_REFERRALS_ENABLED = Boolean(GRAPH_AUTH_CONFIGURED && OWNER_MAILBOX);

if (!GRAPH_REFERRALS_ENABLED) {
  console.log(
    "[graphExcel] GRAPH_TENANT_ID/GRAPH_CLIENT_ID/GRAPH_CLIENT_SECRET/GRAPH_REFERRALS_OWNER " +
      "(o GRAPH_SENDER_MAILBOX) no están configurados todavía — la lista de referidos del panel " +
      "queda deshabilitada (no rompe nada más)."
  );
}

// Convierte el nombre de columna de la tabla de Excel (ver
// Hueco2_Referidos_Guia.docx: Fecha, NombreQuienRefiere, CorreoQuienRefiere,
// NombreReferido, CorreoReferido, MensajePersonal) en las llaves que usa el
// panel — por si algún día cambian el orden de columnas en Excel, esto lee
// por NOMBRE de columna, no por posición.
const COLUMN_KEY_MAP = {
  Fecha: "date",
  NombreQuienRefiere: "referrerName",
  CorreoQuienRefiere: "referrerEmail",
  NombreReferido: "referredName",
  CorreoReferido: "referredEmail",
  MensajePersonal: "personalMessage",
};

/**
 * Lee todas las filas de la tabla de referidos y las devuelve como objetos
 * { date, referrerName, referrerEmail, referredName, referredEmail,
 *   personalMessage }. Lanza un error legible si algo falla (permiso no
 * otorgado, archivo no encontrado, tabla renombrada, etc.) — quien llama
 * decide cómo mostrarlo (ver routes/admin.js).
 */
async function listReferrals() {
  if (!GRAPH_REFERRALS_ENABLED) {
    const err = new Error(
      "La lectura de referidos no está configurada (falta GRAPH_REFERRALS_OWNER/GRAPH_SENDER_MAILBOX)."
    );
    err.code = "disabled";
    throw err;
  }
  const accessToken = await getAccessToken();

  // encodeURIComponent en cada segmento de la ruta, pero conservando las
  // barras "/" que separan carpetas — root:/<ruta>:/workbook/... es la
  // sintaxis de Graph para direccionar un archivo por su ruta dentro del
  // drive (en vez de por su item-id).
  const encodedPath = FILE_PATH.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  const url =
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(OWNER_MAILBOX)}` +
    `/drive/root:/${encodedPath}:/workbook/tables/${encodeURIComponent(TABLE_NAME)}/rows`;

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    const err = new Error(`Graph respondió ${resp.status} leyendo la tabla de referidos: ${text}`);
    err.code = "graph-error";
    throw err;
  }
  const data = await resp.json();

  // La API de Excel devuelve cada fila como un array de arrays (una fila de
  // celdas) en el mismo orden de columnas que tiene la tabla real — por eso
  // necesitamos también el encabezado para saber qué columna es cuál. Un
  // segundo llamado trae los encabezados; se hace en paralelo con las filas
  // arriba solo si hace falta (aquí, secuencial por simplicidad ya que esta
  // lista se consulta poco — un clic en la pestaña del panel, no en cada
  // carga de página).
  const headerUrl =
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(OWNER_MAILBOX)}` +
    `/drive/root:/${encodedPath}:/workbook/tables/${encodeURIComponent(TABLE_NAME)}/headerRowRange`;
  const headerResp = await fetch(headerUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!headerResp.ok) {
    const text = await headerResp.text().catch(() => "");
    const err = new Error(`Graph respondió ${headerResp.status} leyendo los encabezados de la tabla: ${text}`);
    err.code = "graph-error";
    throw err;
  }
  const headerData = await headerResp.json();
  const headers = (headerData.values && headerData.values[0]) || [];

  const rows = (data.value || []).map((row) => {
    const cells = (row.values && row.values[0]) || [];
    const obj = {};
    headers.forEach((h, i) => {
      const key = COLUMN_KEY_MAP[h] || h;
      obj[key] = cells[i] !== undefined && cells[i] !== null ? String(cells[i]) : "";
    });
    return obj;
  });

  // Más recientes primero, para que el panel muestre lo último arriba (igual
  // que la tabla de Resultados).
  rows.reverse();
  return rows;
}

module.exports = { listReferrals, GRAPH_REFERRALS_ENABLED, FILE_PATH, TABLE_NAME };
