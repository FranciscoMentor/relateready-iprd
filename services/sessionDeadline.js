// services/sessionDeadline.js
//
// Plazo para agendar la sesión de mentoring gratuita. NO hay fechas escritas en
// el programa; sale de dos lugares del panel:
//   1. Ajuste por persona (submissions.session_until_override): se edita en la
//      ficha del cliente y manda sobre todo lo demás.
//   2. La campaña con la que la persona desbloqueó su informe (el código
//      guardado en payment_reference como "CODE:<código>"): su campo "Sesión
//      gratis hasta" (campaigns.session_until), o, si está vacío, su fecha
//      "Hasta".
// Quien pagó, o llegó con un código que no pertenece a ninguna campaña, no tiene
// plazo (until = null) salvo que se le ponga un ajuste manual.
// Las fechas son AAAA-MM-DD, hora de Ecuador, inclusive: la sesión se puede
// agendar hasta las 23:59 de ese día. Este plazo solo cambia lo que ven las
// personas en el informe, el correo y la pantalla; el enlace de reservas de
// Bookings sigue siendo el mismo.

const db = require("../db/init");
const { todayEcuador } = require("./promo");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function campaignFor(sub) {
  const ref = String((sub && sub.payment_reference) || "");
  if (!ref.startsWith("CODE:")) return null;
  const code = ref.slice(5).trim().toUpperCase();
  if (!code) return null;
  let rows;
  try {
    rows = db.prepare("SELECT name, date_from, date_to, session_until FROM campaigns WHERE upper(code) = ? ORDER BY id DESC").all(code);
  } catch (e) {
    return null;
  }
  if (!rows.length) return null;
  const day = sub.code_redeemed_at
    ? new Date(Date.parse(sub.code_redeemed_at) - 5 * 3600000).toISOString().slice(0, 10)
    : null;
  // Si el mismo código se usó en varias campañas, la que estaba vigente el día del canje.
  return (day && rows.find((r) => day >= r.date_from && day <= r.date_to)) || rows[0];
}

/** { until: "AAAA-MM-DD"|null, source: "override"|"campaign"|null, expired: boolean, campaign: nombre|null } */
function sessionInfoFor(sub, now = Date.now()) {
  const override = sub && DATE_RE.test(String(sub.session_until_override || "")) ? sub.session_until_override : null;
  let until = null, source = null, campaignName = null;
  if (override) {
    until = override; source = "override";
  } else {
    const c = campaignFor(sub);
    if (c) {
      campaignName = c.name;
      const d = DATE_RE.test(String(c.session_until || "")) ? c.session_until : DATE_RE.test(String(c.date_to || "")) ? c.date_to : null;
      if (d) { until = d; source = "campaign"; }
    }
  }
  return { until, source, campaign: campaignName, expired: !!until && todayEcuador(now) > until };
}

module.exports = { sessionInfoFor };
