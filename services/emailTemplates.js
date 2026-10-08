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
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
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

// "20:00" (lo que produce un <input type="time">, ver routes/
// speedDatingAdmin.js) -> "8:00 p.m." / "8:00 PM". NULL si el evento no
// tiene hora configurada (sd_events.event_time).
function formatEventTime(timeStr, lang) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const isPm = h >= 12;
  const h12 = ((h + 11) % 12) + 1;
  const period = lang === "en" ? (isPm ? "PM" : "AM") : (isPm ? "p.m." : "a.m.");
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
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
          <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Thank you for getting your RelateReady Extended Report. You'll find it attached to this email as a PDF, and you can also view it online anytime through the link below.</p>
          <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">Your report includes a free 60-minute intake mentoring session to review your results together — that's also where you'll receive "You First", the free digital book that goes deeper into your 8 pillars.</p>
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
        <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Gracias por adquirir tu Informe Extendido de RelateReady. Lo encontrarás adjunto a este correo en PDF y también podrás consultarlo en línea cuando quieras, a través del enlace que aparece abajo.</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">Tu informe incluye una sesión de mentoría indagatoria gratuita de 60 minutos para revisar tus resultados juntos — y ahí, exclusivamente ahí, recibes "Tú Primero", el libro digital gratuito que profundiza en tus 8 pilares.</p>
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

// ── Speed Dating (piloto Mila Rooftop, 2026-09) ────────────────────────────
// Correo de resultados enviado 48h después de finalizar el evento (ver
// services/speedDatingScheduler.js). "matches" es un array (normalmente 0
// o 1, pero el correo soporta varios) de { partnerName, partnerPhone }.
// partnerPhone es null cuando esa otra persona NO autorizó compartir su
// WhatsApp al registrarse (share_phone_consent) — nunca se expone sin
// permiso explícito, sin importar que haya sido un match mutuo.
function speedDatingMatchEmail({ name, lang, eventName, matches }) {
  const firstName = firstNameOf(name, lang);
  const hasMatches = Array.isArray(matches) && matches.length > 0;

  const matchBlocksEs = hasMatches
    ? matches
        .map(
          (m) => `
        <div style="border:1px solid #E7DFD2;border-radius:10px;padding:14px 16px;margin:0 0 12px;">
          <p style="margin:0 0 4px;font-weight:700;font-size:15px;">${m.partnerName}</p>
          ${
            m.partnerPhone
              ? `<p style="margin:0;font-size:14px;">Escríbele por WhatsApp para preguntarle si puedes llamarle: <strong>${m.partnerPhone}</strong></p>`
              : `<p style="margin:0;font-size:13.5px;color:${MUTED};">Esta persona no autorizó compartir su WhatsApp todavía — cuando ambos lo autoricen, se los enviaremos.</p>`
          }
        </div>`
        )
        .join("")
    : "";

  const matchBlocksEn = hasMatches
    ? matches
        .map(
          (m) => `
        <div style="border:1px solid #E7DFD2;border-radius:10px;padding:14px 16px;margin:0 0 12px;">
          <p style="margin:0 0 4px;font-weight:700;font-size:15px;">${m.partnerName}</p>
          ${
            m.partnerPhone
              ? `<p style="margin:0;font-size:14px;">Message them on WhatsApp to ask if you can call: <strong>${m.partnerPhone}</strong></p>`
              : `<p style="margin:0;font-size:13.5px;color:${MUTED};">This person hasn't authorized sharing their WhatsApp yet — we'll send it as soon as both of you do.</p>`
          }
        </div>`
        )
        .join("")
    : "";

  if (lang === "en") {
    return {
      subject: hasMatches ? `You have a match from ${eventName}! 💛` : `Your results from ${eventName}`,
      html: shell({
        lang,
        bodyHtml: hasMatches
          ? `
          <p style="font-size:16px;margin:0 0 16px;">Hi ${firstName},</p>
          <p style="font-size:15px;line-height:1.6;margin:0 0 20px;">Great news — ${eventName} had ${matches.length === 1 ? "a match" : matches.length + " matches"} for you. Here's who:</p>
          ${matchBlocksEn}
          <p style="font-size:13px;line-height:1.6;margin:20px 0 0;color:${MUTED};">This contact info was shared only because it was a mutual match and both of you authorized it at registration.</p>
        `
          : `
          <p style="font-size:16px;margin:0 0 16px;">Hi ${firstName},</p>
          <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Thanks for joining ${eventName}. This time there wasn't a mutual match — sometimes the timing just isn't right, and that's completely normal at a RelateReady Meetup.</p>
          <p style="font-size:15px;line-height:1.6;margin:0;">We hope to see you at the next RelateReady event!</p>
        `,
      }),
    };
  }
  return {
    subject: hasMatches ? `¡Tienes un match de ${eventName}! 💛` : `Tus resultados de ${eventName}`,
    html: shell({
      lang,
      bodyHtml: hasMatches
        ? `
        <p style="font-size:16px;margin:0 0 16px;">Hola ${firstName},</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 20px;">Buenas noticias — ${eventName} tuvo ${matches.length === 1 ? "un match" : matches.length + " matches"} para ti. Aquí puedes escribirle directo:</p>
        ${matchBlocksEs}
        <p style="font-size:13px;line-height:1.6;margin:20px 0 0;color:${MUTED};">Este contacto se comparte solo porque fue un match mutuo y ambos autorizaron compartirlo al registrarse.</p>
      `
        : `
        <p style="font-size:16px;margin:0 0 16px;">Hola ${firstName},</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Gracias por participar en ${eventName}. Esta vez no hubo un match mutuo — a veces simplemente no coincide el momento, y es completamente normal en un Encuentro RelateReady.</p>
        <p style="font-size:15px;line-height:1.6;margin:0;">¡Esperamos verte en el próximo evento de RelateReady!</p>
      `,
    }),
  };
}

// Se envía automáticamente en el momento en que alguien completa su
// registro a un evento de speed dating — ver POST
// /api/speed-dating/events/:eventId/registro en routes/speedDatingPublic.js.
// No bloquea la respuesta del registro: si el correo falla, el registro
// igual queda guardado (el error solo se registra en consola).
function speedDatingWelcomeEmail({ name, lang, gender, eventName, eventDate, eventTime, venueName, venueAddress, minAge, maxAge, tableNumber, asistenteUrl }) {
  const firstName = firstNameOf(name, lang);

  const formattedDate = eventDate
    ? new Date(`${eventDate}T00:00:00`).toLocaleDateString(lang === "en" ? "en-US" : "es-EC", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : null;
  const formattedTime = formatEventTime(eventTime, lang);

  const ageRangeLabel =
    minAge && maxAge
      ? (lang === "en" ? `Ages ${minAge}–${maxAge}` : `Personas de ${minAge} a ${maxAge} años`)
      : minAge
      ? (lang === "en" ? `Ages ${minAge}+` : `Personas de ${minAge} años en adelante`)
      : maxAge
      ? (lang === "en" ? `Up to age ${maxAge}` : `Personas de hasta ${maxAge} años`)
      : null;

  const detailRowsEs = `
    ${formattedDate ? `<p style="margin:0 0 8px;font-size:14px;"><strong>Fecha:</strong> ${formattedDate}${formattedTime ? `, ${formattedTime}` : ""}</p>` : ""}
    ${venueName ? `<p style="margin:0 0 8px;font-size:14px;"><strong>Lugar:</strong> ${venueName}${venueAddress ? ` — ${venueAddress}` : ""}</p>` : ""}
    ${ageRangeLabel ? `<p style="margin:0 0 8px;font-size:14px;"><strong>Este evento es para:</strong> ${ageRangeLabel}</p>` : ""}
    ${tableNumber ? `<p style="margin:0;font-size:14px;"><strong>Tu mesa fija:</strong> Mesa ${tableNumber} — no te muevas de ahí en toda la noche.</p>` : ""}
  `;
  const detailRowsEn = `
    ${formattedDate ? `<p style="margin:0 0 8px;font-size:14px;"><strong>Date:</strong> ${formattedDate}${formattedTime ? `, ${formattedTime}` : ""}</p>` : ""}
    ${venueName ? `<p style="margin:0 0 8px;font-size:14px;"><strong>Venue:</strong> ${venueName}${venueAddress ? ` — ${venueAddress}` : ""}</p>` : ""}
    ${ageRangeLabel ? `<p style="margin:0 0 8px;font-size:14px;"><strong>This event is for:</strong> ${ageRangeLabel}</p>` : ""}
    ${tableNumber ? `<p style="margin:0;font-size:14px;"><strong>Your fixed table:</strong> Table ${tableNumber} — you'll stay there all night.</p>` : ""}
  `;

  if (lang === "en") {
    return {
      subject: `You're in! Your spot for ${eventName}`,
      html: shell({
        lang,
        bodyHtml: `
          <p style="font-size:16px;margin:0 0 16px;">Hi ${firstName},</p>
          <p style="font-size:15px;line-height:1.6;margin:0 0 20px;">You're registered for <strong>${eventName}</strong>! Save this email — the link below is your personal access for the night.</p>
          <div style="border:1px solid #E7DFD2;border-radius:10px;padding:16px 18px;margin:0 0 20px;">${detailRowsEn}</div>
          <p style="margin:0 0 12px;">${button(asistenteUrl, "View my event screen")}</p>
          <p style="font-size:12.5px;line-height:1.5;margin:16px 0 0;color:${MUTED};">Save this link — you'll need it the night of the event to see your table, vote, and get your results.</p>
        `,
      }),
    };
  }
  const registradoWord = gender === "F" ? "registrada" : "registrado";
  return {
    subject: `¡Ya estás dentro! Tu registro para ${eventName}`,
    html: shell({
      lang,
      bodyHtml: `
        <p style="font-size:16px;margin:0 0 16px;">Hola ${firstName},</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 20px;">¡Ya quedaste ${registradoWord} para <strong>${eventName}</strong>! Guarda este correo — el link de abajo es tu acceso personal durante toda la noche.</p>
        <div style="border:1px solid #E7DFD2;border-radius:10px;padding:16px 18px;margin:0 0 20px;">${detailRowsEs}</div>
        <p style="margin:0 0 12px;">${button(asistenteUrl, "Ver mi pantalla del evento")}</p>
        <p style="font-size:12.5px;line-height:1.5;margin:16px 0 0;color:${MUTED};">Guarda este link — lo vas a necesitar la noche del evento para ver tu mesa, votar y conocer tus resultados.</p>
      `,
    }),
  };
}


// Se envía cuando alguien intenta registrarse a un evento que ya alcanzó su
// aforo máximo (routes/speedDatingPublic.js) — su registro no se pierde,
// queda guardado en sd_waitlist para que el organizador lo invite por
// WhatsApp al próximo evento (panel, routes/speedDatingAdmin.js) apenas se
// confirme fecha.
// genderOnly = true: no fue el evento el que se llenó por completo, sino
// que el propio género de la persona ya llegó a su tope del 60% del aforo
// (ver capacityState en routes/speedDatingPublic.js) mientras el otro
// género sigue con registro abierto — el mensaje lo aclara para que no
// piense que el evento entero se cerró.
function speedDatingWaitlistEmail({ name, lang, eventName, genderOnly }) {
  const firstName = firstNameOf(name, lang);

  if (lang === "en") {
    const situacion = genderOnly
      ? `spots for your group at <strong>${eventName}</strong> just filled up (we keep an even mix of both sides) — but we saved your info.`
      : `<strong>${eventName}</strong> just reached full capacity — but we saved your info.`;
    return {
      subject: genderOnly ? `Spots for your group at ${eventName} are full — you're on the list` : `${eventName} is full — you're on the list for the next one`,
      html: shell({
        lang,
        bodyHtml: `
          <p style="font-size:16px;margin:0 0 16px;">Hi ${firstName},</p>
          <p style="font-size:15px;line-height:1.6;margin:0 0 20px;">${situacion} We'll message you on WhatsApp as soon as we confirm the date for the next event.</p>
          <p style="font-size:12.5px;line-height:1.5;margin:16px 0 0;color:${MUTED};">Thanks for your patience — we can't wait to have you at the next one.</p>
        `,
      }),
    };
  }
  const situacionEs = genderOnly
    ? `ya se llenó el cupo para tu grupo en <strong>${eventName}</strong> (mantenemos un balance parejo entre ambos géneros) — pero guardamos tus datos.`
    : `¡<strong>${eventName}</strong> ya alcanzó su aforo máximo! Guardamos tus datos.`;
  return {
    subject: genderOnly ? `Se llenó el cupo para tu grupo en ${eventName} — quedaste en la lista` : `${eventName} se llenó — quedaste en la lista para el próximo`,
    html: shell({
      lang,
      bodyHtml: `
        <p style="font-size:16px;margin:0 0 16px;">Hola ${firstName},</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 20px;">${situacionEs} Te vamos a escribir por WhatsApp apenas tengamos fecha confirmada para el próximo evento.</p>
        <p style="font-size:12.5px;line-height:1.5;margin:16px 0 0;color:${MUTED};">Gracias por tu paciencia — ¡nos encantaría tenerte en el próximo!</p>
      `,
    }),
  };
}


// Cuerpo compartido de los dos recordatorios (3 días y 1 día antes) — solo
// cambia el título/urgencia y si se incluye el link de cancelar (Francisco
// pidió que el de 3 días sí lo tenga, para liberar cupo a tiempo, pero el
// de 1 día no, ya muy sobre la hora). Español únicamente: a diferencia del
// test general (bilingüe), todo el flujo de speed dating ya se maneja en
// español (routes/speedDatingPublic.js siempre llama con lang: "es").
function speedDatingReminderBodyEs({ firstName, eventName, formattedDate, formattedTime, venueName, venueAddress, tableNumber, asistenteUrl, testUrl, headline, includeCancelLink, correctionNote, startButtonNote, beforeNightPhrase }) {
  return `
    <p style="font-size:16px;margin:0 0 16px;">Hola ${firstName},</p>
    ${correctionNote ? `<div style="background:#FBF3E7;border:1px solid #E9D2A6;border-radius:10px;padding:14px 16px;margin:0 0 20px;"><p style="margin:0;font-size:14px;line-height:1.55;">Disculpa la confusión: por un error técnico nuestro, es posible que hayas recibido este recordatorio antes de tiempo. Para que quede claro: <strong>el evento es mañana</strong>${formattedDate ? ` — ${formattedDate}` : ""}${formattedTime ? `, ${formattedTime}` : ""} — no hoy. ¡Te esperamos!</p></div>` : ""}
    <p style="font-size:15px;line-height:1.6;margin:0 0 20px;">${headline} <strong>${eventName}</strong>.</p>
    <div style="border:1px solid #E7DFD2;border-radius:10px;padding:16px 18px;margin:0 0 20px;">
      ${formattedDate ? `<p style="margin:0 0 8px;font-size:14px;"><strong>Fecha:</strong> ${formattedDate}${formattedTime ? `, ${formattedTime}` : ""}</p>` : ""}
      ${venueName ? `<p style="margin:0;font-size:14px;"><strong>Lugar:</strong> ${venueName}${venueAddress ? ` — ${venueAddress}` : ""}</p>` : ""}
      <p style="margin:8px 0 0;font-size:14px;"><strong>Parqueadero gratis disponible en el edificio.</strong></p>
      ${tableNumber ? `<p style="margin:8px 0 0;font-size:14px;"><strong>Tu mesa fija:</strong> Mesa ${tableNumber} — no te muevas de ahí en toda la noche.</p>` : ""}
      <p style="margin:8px 0 0;font-size:14px;"><strong>Importante:</strong> lleva tu <strong>celular cargado</strong> — lo vas a necesitar para participar en el evento.</p>
    </div>
    <p style="font-size:15px;line-height:1.6;margin:0 0 14px;">Antes de ${beforeNightPhrase || "esa noche"}, te recomendamos hacer el test de RelateReady (toma unos 10 minutos) — te ayuda a entender mejor tu estilo en las relaciones, así llegas con más claridad a tus conversaciones.</p>
    <p style="font-size:13.5px;line-height:1.5;margin:0 0 20px;color:${MUTED};">Ojo: no hace falta que pagues por el informe completo — durante el evento vamos a sortear varios códigos para descargarlo gratis.</p>
    <p style="margin:0 0 20px;">${button(testUrl, "Hacer el test de RelateReady")}</p>
    <p style="margin:0 0 12px;">${button(asistenteUrl, "Ver mi pantalla del evento")}</p>
    ${startButtonNote ? `<div style="background:#FBF3E7;border:1px solid #E9D2A6;border-radius:10px;padding:14px 16px;margin:12px 0 0;"><p style="margin:0;font-size:13.5px;line-height:1.55;">📌 <strong>Ten este correo a la mano esta noche:</strong> apenas comience el evento, entra aquí mismo y presiona el botón de arriba para abrir tu pantalla y empezar a participar.</p></div>` : ""}
    ${includeCancelLink ? `<p style="font-size:12.5px;line-height:1.5;margin:20px 0 0;color:${MUTED};">¿No vas a poder asistir? <a href="${asistenteUrl}" style="color:${MUTED};">Cancela tu cupo aquí</a> para que se lo demos a alguien más.</p>` : ""}
  `;
}

// Se envía automáticamente 3 días antes de la fecha del evento (ver
// services/speedDatingReminderScheduler.js) — sí incluye el link para
// cancelar, porque todavía da tiempo de liberar el cupo y ofrecérselo a la
// lista de espera.
function speedDatingReminder3dEmail({ name, eventName, eventDate, eventTime, venueName, venueAddress, tableNumber, asistenteUrl, testUrl }) {
  const firstName = firstNameOf(name, "es");
  const formattedDate = eventDate
    ? new Date(`${eventDate}T00:00:00`).toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" })
    : null;
  const formattedTime = formatEventTime(eventTime, "es");
  return {
    subject: `Faltan 3 días para ${eventName} 🎉`,
    html: shell({
      lang: "es",
      bodyHtml: speedDatingReminderBodyEs({
        firstName,
        eventName,
        formattedDate,
        formattedTime,
        venueName,
        venueAddress,
        tableNumber,
        asistenteUrl,
        testUrl,
        headline: "¡Ya casi llega la noche de",
        includeCancelLink: true,
      }),
    }),
  };
}

// Se envía automáticamente el día antes del evento. Mismo contenido que el
// de 3 días, pero sin el link de cancelar (a esta altura ya es muy sobre la
// hora para reacomodar mesas) y con un tono de "es mañana".
function speedDatingReminder1dEmail({ name, eventName, eventDate, eventTime, venueName, venueAddress, tableNumber, asistenteUrl, testUrl, correctionNote }) {
  const firstName = firstNameOf(name, "es");
  const formattedDate = eventDate
    ? new Date(`${eventDate}T00:00:00`).toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" })
    : null;
  const formattedTime = formatEventTime(eventTime, "es");
  return {
    subject: `¡Mañana es ${eventName}! 💛`,
    html: shell({
      lang: "es",
      bodyHtml: speedDatingReminderBodyEs({
        firstName,
        eventName,
        formattedDate,
        formattedTime,
        venueName,
        venueAddress,
        tableNumber,
        asistenteUrl,
        testUrl,
        headline: "¡Mañana es el gran día!",
        includeCancelLink: false,
        correctionNote,
      }),
    }),
  };
}

// Recordatorio adicional del MISMO día del evento (unas horas antes) — se
// dispara manualmente desde el panel (botón "Enviar recordatorio del mismo
// día", ver routes/speedDatingAdmin.js y services/speedDatingReminderScheduler
// .js), no por el cron automático de 3d/1d. Mismo contenido que el de 1 día,
// pero nunca lleva la nota de corrección/disculpa (correctionNote) y sí
// lleva el aviso de "ten este correo a la mano" para abrir la pantalla del
// evento apenas comience.
function speedDatingSameDayReminderEmail({ name, eventName, eventDate, eventTime, venueName, venueAddress, tableNumber, asistenteUrl, testUrl }) {
  const firstName = firstNameOf(name, "es");
  const formattedDate = eventDate
    ? new Date(`${eventDate}T00:00:00`).toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" })
    : null;
  const formattedTime = formatEventTime(eventTime, "es");
  return {
    subject: `Faltan pocas horas para ${eventName} 🎉`,
    html: shell({
      lang: "es",
      bodyHtml: speedDatingReminderBodyEs({
        firstName,
        eventName,
        formattedDate,
        formattedTime,
        venueName,
        venueAddress,
        tableNumber,
        asistenteUrl,
        testUrl,
        headline: "Esta será una noche especial — ya faltan pocas horas para",
        includeCancelLink: false,
        correctionNote: false,
        startButtonNote: true,
        beforeNightPhrase: "llegar esta noche",
      }),
    }),
  };
}

// ── Encuesta de satisfacción (2026-10) ─────────────────────────────────────
// Correo enviado la mañana siguiente al evento, antes del mediodía (hora de
// Ecuador) — ver services/speedDatingSurveyScheduler.js. Distinto del correo
// de resultados/matches de 48h: aquí NO se habla de matches porque todavía
// no se han calculado ni enviado. surveyUrl lleva el mismo vote_token que ya
// usa cada asistente para votar en vivo (routes/speedDatingPublic.js) — no
// hace falta un login ni un token nuevo.
function speedDatingSurveyEmail({ name, eventName, venueName, surveyUrl }) {
  const firstName = firstNameOf(name, "es");
  const venuePhrase = venueName ? ` en ${venueName}` : "";
  return {
    subject: `¿Cómo te fue en ${eventName}? Cuéntanos en 2 minutos 💬`,
    html: shell({
      lang: "es",
      bodyHtml: `
        <p style="font-size:16px;margin:0 0 16px;">Hola ${firstName},</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Gracias por haber sido parte de <b>${eventName}</b>${venuePhrase}. Nos encantaría saber cómo viviste la noche — tu opinión nos ayuda a mejorar cada evento.</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">Son solo 6 preguntas cortas, te toma menos de 2 minutos.</p>
        <p style="margin:0 0 12px;">${button(surveyUrl, "Responder la encuesta")}</p>
        <p style="font-size:13px;line-height:1.6;margin:0;color:${MUTED};">Tu respuesta es anónima para los demás asistentes y solo se usa para mejorar futuros eventos.</p>
      `,
    }),
  };
}

// ── Recordatorio de encuesta (2026-10) ─────────────────────────────────────
// Segundo correo, enviado a mano desde el panel, a quien asistió al evento y
// todavía no contestó la encuesta. Además recuerda que el código VIP para
// descargar gratis el Informe Extendido vence en una fecha límite.
// vipMode: "results" = ya hizo el test (vipUrl = su enlace personal de
// resultados, /?sid=...), "test" = todavía no lo ha hecho (vipUrl = página del
// test), "none" = ya tiene su informe completo, no se le muestra el recuadro.
function speedDatingSurveyReminderEmail({ name, eventName, eventDate, venueName, surveyUrl, vipMode, vipUrl, vipDeadlineText = "en 3 días" }) {
  const firstName = firstNameOf(name, "es");
  const dateText = eventDate
    ? ` el ${new Date(`${eventDate}T00:00:00`).toLocaleDateString("es-EC", { day: "numeric", month: "long" })}`
    : "";
  const subjectPlace = venueName ? `la noche en ${venueName}` : eventName;

  let vipHtml = "";
  if (vipMode === "results" || vipMode === "test") {
    const instruction =
      vipMode === "results"
        ? `Para usarlo, vuelve al enlace de tus resultados, el mismo donde viste el resumen de tu informe. Ahí ingresa tu código y descarga gratis tu informe completo.`
        : `Todavía no hemos recibido tu Test RelateReady. Te toma pocos minutos: complétalo, ingresa tu código en la pantalla de resultados y descarga gratis tu informe completo.`;
    const label = vipMode === "results" ? "Ir a mis resultados" : "Hacer el Test RelateReady";
    vipHtml = `
        <div style="background:#F7F1E4;border:1px solid #E7DFD2;border-radius:10px;padding:18px 20px;margin:26px 0 20px;">
          <p style="font-size:15px;line-height:1.6;margin:0 0 12px;"><b>Un recordatorio importante</b></p>
          <p style="font-size:15px;line-height:1.6;margin:0 0 12px;">Si eres una de las personas que ganó el <b>código VIP</b>, recuerda que vence <b>${vipDeadlineText}</b>.</p>
          <p style="font-size:15px;line-height:1.6;margin:0 0 14px;">${instruction}</p>
          <p style="margin:0;">${button(vipUrl, label)}</p>
        </div>`;
  }

  return {
    subject: `Tu opinión sobre ${subjectPlace} (2 minutos)`,
    html: shell({
      lang: "es",
      bodyHtml: `
        <p style="font-size:16px;margin:0 0 16px;">Hola ${firstName},</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Espero que estés teniendo una buena semana. Quiero agradecerte de nuevo por haber sido parte de <b>${eventName}</b>${dateText}.</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Vi que todavía no has respondido la encuesta de la noche. Sé que los días se llenan rápido, por eso te escribo personalmente: son solo <b>6 preguntas cortas</b> y te toman menos de 2 minutos.</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Tu opinión es lo que nos permite cuidar y mejorar la calidad de la experiencia en los próximos eventos: qué funcionó bien y qué podemos hacer mejor. Cada respuesta cuenta.</p>
        <p style="margin:24px 0 12px;">${button(surveyUrl, "Responder la encuesta")}</p>
        <p style="font-size:13px;line-height:1.6;margin:0;color:${MUTED};">Tu respuesta es anónima para los demás asistentes y solo se usa para mejorar futuros eventos.</p>${vipHtml}
        <p style="font-size:15px;line-height:1.6;margin:20px 0 16px;">Gracias por ayudarnos a construir encuentros cada vez más valiosos.</p>
        <p style="font-size:15px;line-height:1.6;margin:0;">Con aprecio,<br><b>Dr. Francisco Rosero</b><br><span style="font-size:13px;color:${MUTED};">RelateReady</span></p>
      `,
    }),
  };
}

// ── Invitación a hacer el test (2026-10) ───────────────────────────────────
// Correo que Francisco envía a mano desde /panel-control a una persona nueva
// (nombre y correo escritos a mano). Bilingüe: lang "es" | "en". testUrl ya
// trae el idioma (en inglés, /?lang=en).
function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function testInvitationEmail({ name, lang, testUrl, repName }) {
  const en = lang === "en";
  const firstName = escapeHtml(firstNameOf(name, en ? "en" : "es"));
  // Variante "a nombre de un representante": el correo lo firma Francisco y
  // presenta al representante, que recibe las respuestas (replyTo).
  const rep = String(repName || "").replace(/[\r\n]+/g, " ").trim();
  if (rep) {
    const repHtml = escapeHtml(rep);
    if (en) {
      return {
        subject: `${rep} invites you to take the RelateReady Test`,
        html: shell({
          lang: "en",
          bodyHtml: `
        <p style="font-size:16px;margin:0 0 16px;">Hello ${firstName},</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">I hope your week is going well. I'm writing on behalf of <b>${repHtml}</b>, a RelateReady Representative, who would like to invite you to take the <b>RelateReady Test</b>, a relationship-readiness tool that helps you see where you stand today in every relationship.</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">It looks at 8 pillars, including attachment security, communication and repair, and clarity of values, and when you finish you instantly get a summary of your results. There are no right or wrong answers: it's a well-rounded self-assessment that highlights strengths, acknowledges areas for improvement, and shows a clear plan for future growth.</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">It only takes a few minutes.</p>
        <p style="margin:0 0 24px;">${button(testUrl, "Take the test")}</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 20px;">If you have any questions, just reply to this email and ${repHtml} will get back to you.</p>
        <p style="font-size:15px;line-height:1.6;margin:0;">Warmly,<br><b>Dr. Francisco Rosero</b><br><span style="font-size:13px;color:${MUTED};">RelateReady</span></p>
      `,
        }),
      };
    }
    return {
      subject: `${rep} te invita a hacer el Test RelateReady`,
      html: shell({
        lang: "es",
        bodyHtml: `
        <p style="font-size:16px;margin:0 0 16px;">Hola ${firstName},</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Espero que estés teniendo una buena semana. Te escribo de parte de <b>${repHtml}</b>, Representante de RelateReady, quien quiere invitarte a hacer el <b>Test RelateReady</b>, una herramienta de preparación relacional que te ayuda a conocer cómo estás hoy en cada una de tus relaciones.</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Evalúa 8 pilares, entre ellos la seguridad de apego, la comunicación y reparación, y la claridad de tus valores, y al terminar recibes de inmediato un resumen de tus resultados. No hay respuestas correctas o incorrectas: es una autoevaluación integral que destaca tus fortalezas, reconoce tus áreas de mejora y te muestra un plan claro para tu crecimiento futuro.</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">Te toma unos minutos.</p>
        <p style="margin:0 0 24px;">${button(testUrl, "Hacer el test")}</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 20px;">Si tienes alguna duda, puedes responder este correo y ${repHtml} te escribirá.</p>
        <p style="font-size:15px;line-height:1.6;margin:0;">Con aprecio,<br><b>Dr. Francisco Rosero</b><br><span style="font-size:13px;color:${MUTED};">RelateReady</span></p>
      `,
      }),
    };
  }
  if (en) {
    return {
      subject: "I'd like to invite you to take the RelateReady Test",
      html: shell({
        lang: "en",
        bodyHtml: `
        <p style="font-size:16px;margin:0 0 16px;">Hello ${firstName},</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">I hope your week is going well. I'd like to personally invite you to take the <b>RelateReady Test</b>, a relationship-readiness tool that helps you see where you stand today when it comes to romantic relationships.</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">It looks at 8 pillars, including attachment security, communication and repair, and clarity of values, and when you finish you instantly get a summary of your results. There are no right or wrong answers: it's about knowing yourself better and seeing clearly where you are strong and what you can keep developing.</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">It only takes a few minutes.</p>
        <p style="margin:0 0 24px;">${button(testUrl, "Take the test")}</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 20px;">If you have any questions, just reply to this email.</p>
        <p style="font-size:15px;line-height:1.6;margin:0;">Warmly,<br><b>Dr. Francisco Rosero</b><br><span style="font-size:13px;color:${MUTED};">RelateReady</span></p>
      `,
      }),
    };
  }
  return {
    subject: "Te invito a hacer el Test RelateReady",
    html: shell({
      lang: "es",
      bodyHtml: `
        <p style="font-size:16px;margin:0 0 16px;">Hola ${firstName},</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Espero que estés teniendo una buena semana. Quiero invitarte personalmente a hacer el <b>Test RelateReady</b>, una herramienta de preparación relacional que te ayuda a conocer cómo estás hoy frente a las relaciones de pareja.</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Evalúa 8 pilares, entre ellos la seguridad de apego, la comunicación y reparación, y la claridad de tus valores, y al terminar recibes de inmediato un resumen de tus resultados. No hay respuestas correctas o incorrectas: se trata de conocerte mejor y ver con claridad dónde estás fuerte y qué puedes seguir desarrollando.</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">Te toma unos minutos.</p>
        <p style="margin:0 0 24px;">${button(testUrl, "Hacer el test")}</p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 20px;">Si tienes alguna duda, puedes responder este correo.</p>
        <p style="font-size:15px;line-height:1.6;margin:0;">Con aprecio,<br><b>Dr. Francisco Rosero</b><br><span style="font-size:13px;color:${MUTED};">RelateReady</span></p>
      `,
    }),
  };
}

module.exports = { extendedReportEmail, pendingReportReminderEmail, speedDatingMatchEmail, speedDatingWelcomeEmail, speedDatingWaitlistEmail, speedDatingReminder3dEmail, speedDatingReminder1dEmail, speedDatingSameDayReminderEmail, speedDatingSurveyEmail, speedDatingSurveyReminderEmail, testInvitationEmail };

