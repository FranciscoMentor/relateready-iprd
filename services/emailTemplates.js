// services/emailTemplates.js
//
// Plantillas HTML para los correos automáticos de RelateReady (enviados vía
// services/graphMail.js). Bilingües (ES/EN), con los mismos colores de marca
// que el PDF del Informe Extendido (ver services/pdfGenerator.js).

const ACCENT = "#B5732A";
const INK = "#2A2A28";
const MUTED = "#6B6259";
const PAPER = "#FBF8F3";

// Base pública del sitio, para construir URLs absolutas (el logo del
// encabezado, y de respaldo si algún día se necesitara aquí). Render inyecta
// RENDER_EXTERNAL_URL automáticamente en todo servicio web — no requiere
// configurar nada a mano. Mismo patrón que services/reminderScheduler.js.
const BASE_URL = (process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

// Logo para el encabezado del correo: el lockup horizontal sobre fondo ink
// (mismo archivo de marca usado en las portadas del libro), recortado y
// ajustado al tamaño del encabezado. Vive en public/assets porque ahí ya se
// sirve el resto de los assets estáticos del sitio (ver server.js).
const LOGO_URL = `${BASE_URL}/assets/logo-relateready-header.png`;

// Enlaces de agendamiento de la sesión de mentoría gratuita — los mismos que
// usa la pantalla de resultados (ver public/js/app.js, BOOKING_LINKS). Si se
// cambian ahí, hay que actualizarlos también aquí.
const BOOKING_LINKS = {
  es: "https://outlook.office.com/owa/calendar/FranciscoRoseroMentor@ADAMANTINEHEALING.onmicrosoft.com/bookings/s/eMJ5GQhw_0W_-z2cJN-S9g2",
  en: "https://outlook.office.com/owa/calendar/FranciscoRoseroMentor@ADAMANTINEHEALING.onmicrosoft.com/bookings/s/K4DmDOt-kUSplfAlddYmbw2",
};

function shell({ bodyHtml, lang }) {
  const footer =
    lang === "en" ? "RelateReady — a project by Adamantine Mentoring." : "RelateReady — un proyecto de Adamantine Mentoring.";
  return `<!doctype html>
<html lang="${lang}">
  <body style="margin:0;padding:0;background:${PAPER};font-family:Georgia,'Times New Roman',serif;color:${INK};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #E7DFD2;">
            <tr>
              <td style="background:${INK};padding:18px 28px;">
                <img src="${LOGO_URL}" alt="RelateReady" height="28" style="display:block;height:28px;width:auto;border:0;" />
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;border-top:1px solid #E7DFD2;">
                <span style="color:${MUTED};font-size:12px;">${footer}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(url, label) {
  return `<a href="${url}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-family:Georgia,'Times New Roman',serif;font-size:15px;">${label}</a>`;
}

function firstNameOf(name, lang) {
  const first = String(name || "").trim().split(/\s+/)[0];
  return first || (lang === "en" ? "there" : "");
}

// Se envía la primera vez que alguien genera su Informe Extendido (pago ya
// confirmado) — ver routes/api.js, GET /api/report/extended/:id.
function extendedReportEmail({ name, lang, resultsUrl }) {
  const bookingUrl = BOOKING_LINKS[lang] || BOOKING_LINKS.es;
  const firstName = firstNameOf(name, lang);

  if (lang === "en") {
    return {
      subject: "Your RelateReady Extended Report is ready",
      html: shell({
        lang,
        bodyHtml: `
          <p style="font-size:16px;margin:0 0 16px;">Hi ${firstName},</p>
          <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Thank you for getting your RelateReady Extended Report. It's attached to this email as a PDF, and you can also view it online anytime using the link below.</p>
          <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">Your report includes a free 60-minute intake mentoring session with Dr. Francisco Rosero to review your results together — that's also where you'll receive "You First", the free digital book that goes deeper into your 8 pillars.</p>
          <p style="margin:0 0 12px;">${button(bookingUrl, "Schedule my free session")}</p>
          <p style="margin:20px 0 0;"><a href="${resultsUrl}" style="color:${ACCENT};font-size:14px;">View your results online</a></p>
        `,
      }),
    };
  }
  return {
    subject: "Tu Informe Extendido de RelateReady está listo",
    html: shell({
      lang,
      bodyHtml: `
        <p style="font-size:16px;margin:0 0 16px;">Hola ${firstName},</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Gracias por adquirir tu Informe Extendido de RelateReady. Va adjunto a este correo en PDF, y también puedes verlo en línea cuando quieras con el enlace de abajo.</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">Tu informe incluye una sesión de mentoría indagatoria gratuita de 60 minutos con el Dr. Francisco Rosero para revisar tus resultados juntos — y ahí, exclusivamente ahí, recibes "Tú Primero", el libro digital gratuito que profundiza en tus 8 pilares.</p>
        <p style="margin:0 0 12px;">${button(bookingUrl, "Agendar mi sesión gratuita")}</p>
        <p style="margin:20px 0 0;"><a href="${resultsUrl}" style="color:${ACCENT};font-size:14px;">Ver tus resultados en línea</a></p>
      `,
    }),
  };
}

// Recordatorio automático para quien completó el test, dejó su correo, pero
// todavía no compró el Informe Extendido — ver services/reminderScheduler.js.
function pendingReportReminderEmail({ name, lang, resultsUrl }) {
  const firstName = firstNameOf(name, lang);

  if (lang === "en") {
    return {
      subject: "Your RelateReady results are waiting for you",
      html: shell({
        lang,
        bodyHtml: `
          <p style="font-size:16px;margin:0 0 16px;">Hi ${firstName},</p>
          <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">A little while ago you completed the RelateReady relationship-readiness test — your 8-pillar summary is ready and waiting for you.</p>
          <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">Whenever you're ready, your Extended Report goes deeper into each pillar, with a personalized action plan and a free 60-minute mentoring session included.</p>
          <p style="margin:0;">${button(resultsUrl, "View my results")}</p>
        `,
      }),
    };
  }
  return {
    subject: "Tus resultados de RelateReady te están esperando",
    html: shell({
      lang,
      bodyHtml: `
        <p style="font-size:16px;margin:0 0 16px;">Hola ${firstName},</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Hace un tiempo completaste el test de preparación relacional de RelateReady — tu resumen de los 8 pilares ya está listo y te espera.</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">Cuando quieras, tu Informe Extendido profundiza en cada pilar, con un plan de acción personalizado y una sesión de mentoría gratuita de 60 minutos incluida.</p>
        <p style="margin:0;">${button(resultsUrl, "Ver mis resultados")}</p>
      `,
    }),
  };
}

module.exports = { extendedReportEmail, pendingReportReminderEmail };
