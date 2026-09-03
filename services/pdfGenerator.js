// Generador de PDF (pdfkit) — Preview gratuito e Informe Extendido de RelateReady.
const PDFDocument = require("pdfkit");
const path = require("path");
const { dimensionLabel, DIMENSION_CODES } = require("../data/dimensions");
const { getBandContent, SOCIAL_DESIRABILITY_NOTE, REFERRAL_MESSAGE } = require("../data/reportContent");

// Set de 8 íconos de marca (uno por pilar/dimensión), aprobado por Francisco
// y ya usado en el libro digital gratuito "Tú Primero"/"You First" para abrir
// cada capítulo de pilar. Aquí se reutilizan (sin recolorear/redibujar) para
// que test, informe y libro compartan una sola identidad visual. Ver handoff
// en Documents/Libro para RelateReady/Handoff Informe Extendido/
// handoff_iconos_pilares_informe.zip. Mismo código de dimensión (AS/DS/RS/
// CG/CR/AR/IA/CV, ver data/dimensions.js) usado como llave, así que si el
// orden canónico de DIMENSIONS cambia algún día, el ícono correcto lo sigue
// automáticamente.
const DIMENSION_ICON_PATH = Object.fromEntries(
  DIMENSION_CODES.map((code) => [code, path.join(__dirname, "..", "public", "assets", "icons", `icon-${code.toLowerCase()}.png`)])
);

const ACCENT = "#B5732A";
const INK = "#2A2A28";
const MUTED = "#6B6259";
const GREEN = "#3F6B4F";
const AMBER = "#9C6B14";
const CLAY = "#9C3B2E";
const CREAM = "#F4F0E9";
const LIGHT = "#ECE4D6";

const BAND_COLOR = { f: GREEN, m: AMBER, d: CLAY };
const LOGO_PATH = path.join(__dirname, "..", "public", "assets", "relateready-logo.png");
const HERO_HOME_PATH = path.join(__dirname, "..", "public", "assets", "hero-home.jpg");
const ADAMANTINE_LOGO_PATH = path.join(__dirname, "..", "public", "assets", "adamantine-logo.png");
const ADAMANTINE_LOGO_RATIO = 400 / 304; // ancho/alto real del archivo adamantine-logo.png

// Nombre oficial del índice — reemplaza en todo el informe al antiguo
// "IPRD — Índice de Preparación para Relaciones Duraderas".
const INDEX_NAME = { es: "Índice de Desarrollo y Fortalecimiento Relacional", en: "Relationship Development and Strengthening Index" };

// Enlaces de agendamiento de la sesión de mentoría indagatoria gratuita de
// 60 min incluida con el Informe Extendido (mismos enlaces que
// public/js/app.js — si cambian alguno, actualizar en ambos lugares).
// El mentor se menciona de forma genérica (sin nombre propio) en el informe.
const MENTOR_NAME = { es: "un mentor en relaciones y desarrollo personal", en: "a relationship & personal development mentor" };
const BOOKING_LINKS = {
  es: "https://outlook.office.com/owa/calendar/FranciscoRoseroMentor@ADAMANTINEHEALING.onmicrosoft.com/bookings/s/eMJ5GQhw_0W_-z2cJN-S9g2",
  en: "https://outlook.office.com/owa/calendar/FranciscoRoseroMentor@ADAMANTINEHEALING.onmicrosoft.com/bookings/s/K4DmDOt-kUSplfAlddYmbw2",
};

// Libro digital gratuito "Tu Primero" / "You First" (Dr. Francisco Rosero) —
// se entrega EXCLUSIVAMENTE durante la sesión de mentoría gratuita, no viene
// incluido en el Informe Extendido. No está a la venta. Copy aprobado — ver
// handoff en Documents/Libro para RelateReady/Handoff Informe Extendido.
// Igual que MENTOR_NAME arriba, el copy evita decir que Francisco da la
// sesión personalmente (puede ser cualquier mentor del equipo).
// `segments`: lista de trozos {text, bold} en orden — se concatenan para el
// párrafo completo. "bold" marca las frases que deben ir en negrilla (el
// título del libro además va en color de acento, ver bookTeaserBlock).
const BOOK_TEASER = {
  es: {
    label: "Además, recibes",
    segments: [
      { text: "Tu Informe Extendido es solo el primer paso. El siguiente es tu ", bold: false },
      { text: "sesión de mentoría indagatoria gratuita de 60 minutos", bold: true },
      { text: " con uno de los mentores de nuestro equipo — y ahí, exclusivamente ahí, recibirás ", bold: false },
      { text: '"Tú Primero"', bold: true, accent: true },
      { text: ": ", bold: false },
      { text: "el libro digital gratuito", bold: true },
      {
        text: " diseñado para profundizar en tus 8 pilares y acompañarte semanas después de esa conversación. No está a la venta ni disponible por ningún otro medio: es una guía reservada para quienes completan el proceso, informe y sesión de mentoría.",
        bold: false,
      },
    ],
  },
  en: {
    label: "Plus, you get",
    segments: [
      { text: "Your Extended Report is only the first step. The next one is your ", bold: false },
      { text: "free 60-minute discovery mentoring session", bold: true },
      { text: " with one of our team mentors — and that's the exclusive moment you'll receive ", bold: false },
      { text: '"You First"', bold: true, accent: true },
      { text: ": ", bold: false },
      { text: "the free digital book", bold: true },
      {
        text: " designed to deepen your work on the 8 pillars and stay with you long after that conversation ends. It isn't for sale anywhere else: it's reserved for those who complete the process — report and mentoring session.",
        bold: false,
      },
    ],
  },
};
const BOOK_COVER_PATH = {
  es: path.join(__dirname, "..", "public", "assets", "tu-primero-cover-es.jpg"),
  en: path.join(__dirname, "..", "public", "assets", "you-first-cover-en.jpg"),
};
// Relación alto/ancho real de ambas portadas (1024×1536 y 843×1264 — ambas
// ~1.5). doc.image() con x/y absolutos no actualiza doc.y solo, así que la
// usamos para calcular a mano cuánto avanzar el cursor después de dibujarla.
const BOOK_COVER_RATIO = 1.5;

// Inserta una ilustración de marca en el PDF (mismo estilo/paleta que
// hero-home.jpg, usada también en la página de inicio del sitio). Pensado
// para poder agregar MÁS ilustraciones similares en otros puntos del informe
// en el futuro: genera la imagen (mismo prompt/estilo que hero-home.jpg —
// ver conversación de diseño), guárdala en public/assets/, y llama a esta
// función con su ruta, posición y ancho. Si el archivo todavía no existe,
// no rompe la generación del PDF — simplemente no dibuja nada.
function illustration(doc, imagePath, x, y, width) {
  try {
    doc.image(imagePath, x, y, { width });
  } catch (e) {
    // imagen no disponible todavía — se omite en silencio.
  }
}

// Dibuja "Desarrollado por" + el logotipo real de Adamantine (no el nombre
// en texto), centrado horizontalmente en centerX. Usado tanto en el pie de
// página de cada página de contenido como en la portada, cada uno con su
// propio tamaño de texto/logo.
function developedByLockup(doc, lang, centerX, y, fontSize, logoH) {
  const label = T(lang, "Desarrollado por", "Developed by");
  const logoW = logoH * ADAMANTINE_LOGO_RATIO;
  const gap = 6;
  doc.fontSize(fontSize).font("Helvetica").fillColor(MUTED);
  const labelW = doc.widthOfString(label);
  const totalW = labelW + gap + logoW;
  const startX = centerX - totalW / 2;
  doc.text(label, startX, y, { width: labelW + 2, lineBreak: false });
  try {
    doc.image(ADAMANTINE_LOGO_PATH, startX + labelW + gap, y - (logoH - fontSize * 1.15) / 2, { width: logoW, height: logoH });
  } catch (e) {
    // logo todavía no disponible — se omite en silencio, queda solo el texto.
  }
  doc.fillColor(INK).font("Helvetica");
}

const PAGE_MARGIN = 56;

function T(lang, es, en) {
  return lang === "en" ? en : es;
}

function newDoc() {
  return new PDFDocument({ size: "LETTER", margin: PAGE_MARGIN, bufferPages: true });
}

function drawHeaderFooter(doc, lang) {
  const range = doc.bufferedPageRange();
  // El número de página visible empieza en 1 en la primera página de
  // contenido (la portada, i === 0, no lleva encabezado ni número).
  let pageNum = 0;
  // El pie de página se dibuja en y=762, que cae DEBAJO del margen inferior
  // de la página (792 - 56 = 736). pdfkit interpreta cualquier .text() más
  // allá del margen como desborde y agrega automáticamente una página nueva
  // en blanco (bug clásico de pdfkit con encabezados/pies). La solución
  // estándar: poner el margen inferior en 0 mientras se dibuja el pie, y
  // restaurarlo después — así pdfkit ya no "corrige" nada por su cuenta.
  const originalBottomMargin = doc.page.margins.bottom;
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    if (i === 0) continue; // sin encabezado/pie en la portada
    pageNum += 1;
    doc.page.margins.bottom = 0;
    doc
      .fontSize(8)
      .fillColor(MUTED)
      .text(T(lang, `RELATEREADY · ${INDEX_NAME.es}`, `RELATEREADY · ${INDEX_NAME.en}`), PAGE_MARGIN, 28, {
        width: 612 - PAGE_MARGIN * 2 - 150,
        continued: false,
      });
    doc.fontSize(8).fillColor(MUTED).text("ADAMANTINE", 612 - PAGE_MARGIN - 150, 28, { width: 150, align: "right" });

    // Pie de página en TODAS las páginas de contenido: "Desarrollado por" +
    // el logotipo real de Adamantine (no el nombre en texto) + número de
    // página dentro de un círculo de color de marca. Logo a 40pt de alto
    // (el doble que la versión anterior de 20pt, a pedido explícito).
    developedByLockup(doc, lang, 306, 762, 8, 40);

    const circleR = 10;
    const circleCx = 612 - PAGE_MARGIN - circleR;
    const circleCy = 762 + 5;
    doc.circle(circleCx, circleCy, circleR).fill(ACCENT);
    doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#FFFFFF").text(String(pageNum), circleCx - circleR, circleCy - 4, { width: circleR * 2, align: "center" });
    doc.fillColor(INK).font("Helvetica");
    doc.page.margins.bottom = originalBottomMargin;
  }
}

function h1(doc, text) {
  doc.moveDown(0.6);
  doc.fontSize(17).fillColor(ACCENT).font("Helvetica-Bold").text(text);
  doc.moveTo(doc.x, doc.y + 2).lineTo(612 - PAGE_MARGIN, doc.y + 2).strokeColor(ACCENT).lineWidth(1).stroke();
  doc.moveDown(0.5);
  doc.font("Helvetica").fillColor(INK);
}

function h2(doc, text, color = INK) {
  doc.moveDown(0.4);
  doc.fontSize(13).fillColor(color).font("Helvetica-Bold").text(text);
  doc.moveDown(0.2);
  doc.font("Helvetica").fillColor(INK);
}

// Igual que h2, pero con el ícono de la dimensión a la izquierda del título
// (en línea, mismo renglón). Usado en el detalle completo de las 8
// dimensiones, para reforzar visualmente qué pilar es cada sección. El
// ícono se centra verticalmente respecto al bloque de texto (que puede
// ocupar 1 o 2 líneas según el largo del título).
function h2WithIcon(doc, iconPath, text, color = INK) {
  doc.moveDown(0.4);
  const iconSize = 26;
  const gap = 8;
  const startX = doc.x;
  const textX = startX + iconSize + gap;
  const textWidth = 612 - PAGE_MARGIN - textX;
  const startY = doc.y;
  doc.fontSize(13).font("Helvetica-Bold");
  const textHeight = doc.heightOfString(text, { width: textWidth });
  // Centrado real respecto al bloque de texto (sin recortar a 0): si el
  // título ocupa una sola línea, el ícono es más alto que el texto, así que
  // su borde superior queda un poco por ENCIMA de startY a propósito — así
  // el centro del ícono coincide con el centro vertical del texto en vez de
  // quedar más abajo (ver captura de Francisco: con el clamp a 0 el ícono se
  // veía descolgado respecto al título).
  const iconY = startY + (textHeight - iconSize) / 2;
  illustration(doc, iconPath, startX, iconY, iconSize);
  doc.fillColor(color).text(text, textX, startY, { width: textWidth });
  doc.y = Math.max(doc.y, iconY + iconSize);
  doc.x = PAGE_MARGIN;
  doc.moveDown(0.2);
  doc.font("Helvetica").fillColor(INK);
}

// Grilla de referencia rápida con los 8 íconos + nombre de cada pilar,
// mostrados juntos en el orden canónico (4 columnas x 2 filas). Se usa en
// la página de "Cómo leer tu perfil", antes del radar, como mapa visual de
// las 8 dimensiones que vienen a continuación.
function dimensionIconsGrid(doc, lang) {
  const contentWidth = 612 - PAGE_MARGIN * 2;
  const cols = 4;
  const cellW = contentWidth / cols;
  const iconSize = 34;
  const labelGap = 6;
  const rowHeight = 72;
  const startY = doc.y;

  DIMENSION_CODES.forEach((code, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cellX = PAGE_MARGIN + col * cellW;
    const cellCenterX = cellX + cellW / 2;
    const iconY = startY + row * rowHeight;
    illustration(doc, DIMENSION_ICON_PATH[code], cellCenterX - iconSize / 2, iconY, iconSize);
    doc.fontSize(7.5).font("Helvetica-Bold").fillColor(INK);
    doc.text(dimensionLabel(code, lang), cellX + 3, iconY + iconSize + labelGap, { width: cellW - 6, align: "center" });
  });

  const rows = Math.ceil(DIMENSION_CODES.length / cols);
  doc.y = startY + rows * rowHeight + 6;
  doc.x = PAGE_MARGIN;
  doc.font("Helvetica").fillColor(INK);
}

function body(doc, text) {
  doc.fontSize(10.5).fillColor(INK).font("Helvetica").text(text, { align: "left", lineGap: 3 });
  doc.moveDown(0.4);
}

function note(doc, text) {
  doc.fontSize(9).fillColor(MUTED).font("Helvetica-Oblique").text(text, { lineGap: 2 });
  doc.moveDown(0.4);
  doc.font("Helvetica");
}

// Límite inferior útil del contenido, antes del pie de página (que ocupa
// desde ~755 hacia abajo). Todas las secciones del informe deben chequear
// contra este límite en vez de forzar doc.addPage() sin necesidad — así se
// evitan páginas casi vacías y saltos de sección con demasiado aire.
const CONTENT_BOTTOM = 730;

// Solo agrega una página nueva si lo que sigue (de altura aproximada
// minHeight) ya no cabe en el espacio restante de la página actual. Es el
// reemplazo de los doc.addPage() incondicionales que dejaban páginas casi
// en blanco cuando una sección terminaba temprano.
function ensureSpace(doc, minHeight) {
  if (doc.y + minHeight > CONTENT_BOTTOM) {
    doc.addPage();
  } else {
    doc.moveDown(0.8);
  }
}

// Dibuja un "botón" real dentro del PDF: un rectángulo redondeado de color
// de marca con texto centrado, y una anotación de enlace clicable encima que
// abre `url` en el navegador al hacer clic (pdfkit -> doc.link()).
function linkButton(doc, text, url, opts = {}) {
  const width = opts.width || 612 - PAGE_MARGIN * 2;
  const height = opts.height || 28;
  const x = opts.x !== undefined ? opts.x : PAGE_MARGIN;
  if (doc.y + height > CONTENT_BOTTOM) doc.addPage();
  const y = doc.y;
  doc.roundedRect(x, y, width, height, 6).fill(ACCENT);
  doc
    .fontSize(10.5)
    .font("Helvetica-Bold")
    .fillColor("#FFFFFF")
    .text(text, x, y + height / 2 - 5.5, { width, align: "center" });
  doc.link(x, y, width, height, url);
  doc.font("Helvetica").fillColor(INK);
  doc.y = y + height;
  doc.x = PAGE_MARGIN;
  doc.moveDown(0.6);
}

// Bloque adicional que anuncia el libro digital gratuito "Tu Primero"/"You
// First" — NO reemplaza el CTA de agendar la sesión de mentoría (linkButton
// de arriba); se suma después, como un beneficio extra que el lector todavía
// no conoce. Ver BOOK_TEASER arriba para el copy aprobado. Layout a dos
// columnas (portada a la izquierda, texto a la derecha) por pedido explícito
// del dueño del proyecto — más prolijo que la portada centrada debajo del
// párrafo que se usó en la primera versión.
function bookTeaserBlock(doc, lang) {
  const copy = BOOK_TEASER[lang] || BOOK_TEASER.es;
  const contentWidth = 612 - PAGE_MARGIN * 2;
  const imgWidth = 105;
  const gap = 18;
  const textX = PAGE_MARGIN + imgWidth + gap;
  const textWidth = contentWidth - imgWidth - gap;
  const imgHeight = imgWidth * BOOK_COVER_RATIO;

  // Estimación de la altura del párrafo para reservar espacio (heightOfString
  // no distingue negrilla/color por tramo, pero Helvetica-Bold a 10.5pt es
  // apenas un poco más ancha que Helvetica — suficiente para estimar sin
  // arriesgarse a un salto de página a mitad del bloque).
  const fullText = copy.segments.map((s) => s.text).join("");
  doc.fontSize(10.5).font("Helvetica");
  const textHeight = doc.heightOfString(fullText, { width: textWidth, lineGap: 3 });
  ensureSpace(doc, 26 + Math.max(imgHeight, textHeight));

  doc.fontSize(8.5).font("Helvetica-Bold").fillColor(ACCENT).text(copy.label.toUpperCase(), { characterSpacing: 1 });
  doc.moveDown(0.3);

  const rowY = doc.y;
  illustration(doc, BOOK_COVER_PATH[lang] || BOOK_COVER_PATH.es, PAGE_MARGIN, rowY, imgWidth);

  doc.fontSize(10.5);
  copy.segments.forEach((seg, i) => {
    const isLast = i === copy.segments.length - 1;
    doc.font(seg.bold ? "Helvetica-Bold" : "Helvetica").fillColor(seg.accent ? ACCENT : INK);
    if (i === 0) {
      doc.text(seg.text, textX, rowY, { width: textWidth, lineGap: 3, continued: !isLast });
    } else {
      doc.text(seg.text, { continued: !isLast, lineGap: 3 });
    }
  });

  doc.y = Math.max(doc.y, rowY + imgHeight) + 10;
  doc.x = PAGE_MARGIN;
  doc.font("Helvetica").fillColor(INK);
}

// Lista de viñetas con el punto en color de acento (en vez del carácter "•"
// en negro plano) — usada en las recomendaciones y en el bloque de venta del
// preview para que se vea más cuidada/profesional.
function bulletList(doc, items, opts = {}) {
  const bulletColor = opts.color || ACCENT;
  const textWidth = 612 - PAGE_MARGIN * 2 - 16;
  items.forEach((it) => {
    doc.fontSize(10.5).font("Helvetica").fillColor(INK);
    const textHeight = doc.heightOfString(it, { width: textWidth, lineGap: 3 });
    if (doc.y + textHeight + 6 > CONTENT_BOTTOM) doc.addPage();
    const startX = doc.x;
    const startY = doc.y;
    doc.fillColor(bulletColor).circle(startX + 3, startY + 6, 2.5).fill();
    doc.fillColor(INK).text(it, startX + 16, startY, { width: textWidth, lineGap: 3 });
    doc.x = startX;
    doc.y = startY + textHeight + 6;
  });
  doc.moveDown(0.3);
}

function aiBlock(doc, text) {
  doc.fontSize(10.5).font("Helvetica-Oblique");
  // Importante: el lineGap aquí debe coincidir con el que se usa más abajo en
  // el doc.text() real — si no, heightOfString() subestima la altura (no
  // cuenta el interlineado extra) y el rectángulo de fondo queda más corto
  // que el texto, cortando visualmente el último párrafo fuera de la caja.
  const textHeight = doc.heightOfString(text, { width: 612 - PAGE_MARGIN * 2 - 14, lineGap: 3 });
  // Protección de desborde: si este bloque (texto generado por IA, de
  // longitud variable) no cabe en lo que queda de página, empieza una
  // página nueva en vez de dejar que se corte contra el pie de página.
  if (doc.y + textHeight + 16 > CONTENT_BOTTOM) {
    doc.addPage();
  }
  const startX = doc.x;
  const startY = doc.y;
  doc.rect(startX - 8, startY - 4, 612 - PAGE_MARGIN * 2 + 8, textHeight + 16).fill(CREAM);
  doc.fillColor(INK).text(text, startX, startY + 4, { width: 612 - PAGE_MARGIN * 2 - 14, lineGap: 3 });
  doc.moveDown(0.6);
  doc.font("Helvetica");
}

// --- Radar chart de las 8 dimensiones, dibujado a mano (sin librería de charts) ---
function drawRadarChart(doc, cx, cy, maxRadius, dims, lang) {
  const n = DIMENSION_CODES.length;
  const angleFor = (i) => -Math.PI / 2 + i * ((2 * Math.PI) / n);

  // Anillos de referencia (25/50/75/100%)
  doc.strokeColor("#DDD6CE").lineWidth(0.5);
  [0.25, 0.5, 0.75, 1].forEach((frac) => {
    for (let i = 0; i <= n; i++) {
      const a = angleFor(i % n);
      const r = maxRadius * frac;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      if (i === 0) doc.moveTo(x, y);
      else doc.lineTo(x, y);
    }
    doc.stroke();
  });

  // Ejes + etiquetas — nombre completo de cada pilar (no las iniciales), con
  // alineación según el cuadrante para que el texto no quede montado sobre
  // el gráfico ni sobre las etiquetas vecinas.
  doc.strokeColor("#DDD6CE").lineWidth(0.5);
  DIMENSION_CODES.forEach((code, i) => {
    const a = angleFor(i);
    const cosA = Math.cos(a);
    const sinA = Math.sin(a);
    const x = cx + maxRadius * Math.cos(a);
    const y = cy + maxRadius * Math.sin(a);
    doc.moveTo(cx, cy).lineTo(x, y).stroke();

    doc.fontSize(7.2).font("Helvetica-Bold");
    const label = dimensionLabel(code, lang);
    const gap = 12;
    const anchorX = cx + (maxRadius + gap) * cosA;
    const anchorY = cy + (maxRadius + gap) * sinA;

    let width, align, boxX;
    if (cosA > 0.3) {
      width = 92; align = "left"; boxX = anchorX;
    } else if (cosA < -0.3) {
      width = 92; align = "right"; boxX = anchorX - width;
    } else {
      width = 118; align = "center"; boxX = anchorX - width / 2;
    }

    const textHeight = doc.heightOfString(label, { width, align });
    let boxY;
    if (sinA < -0.3) boxY = anchorY - textHeight; // eje superior: etiqueta encima del punto
    else if (sinA > 0.3) boxY = anchorY; // eje inferior: etiqueta debajo del punto
    else boxY = anchorY - textHeight / 2; // eje lateral: centrada verticalmente

    doc.fillColor(INK).text(label, boxX, boxY, { width, align });
  });
  doc.font("Helvetica").fontSize(10.5);

  // Polígono de datos
  doc.fillOpacity(0.25).strokeColor(ACCENT).fillColor(ACCENT).lineWidth(1.5);
  DIMENSION_CODES.forEach((code, i) => {
    const a = angleFor(i);
    const r = maxRadius * (dims[code].index / 100);
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i === 0) doc.moveTo(x, y);
    else doc.lineTo(x, y);
  });
  doc.closePath().fillAndStroke(ACCENT, ACCENT);
  doc.fillOpacity(1);
  doc.fillColor(INK);
}

function supportTable(doc, dims, lang) {
  const headers = [T(lang, "Dimensión", "Dimension"), T(lang, "Índice", "Index"), T(lang, "Banda", "Band")];
  const colW = [260, 70, 140];
  let x = PAGE_MARGIN;
  let y = doc.y;
  // Protección de desborde: si la tabla completa (encabezado + 8 filas, ~146pt)
  // no cabe en lo que queda de página, empieza en una página nueva en vez de
  // dejar que pdfkit auto-pagine fila por fila (lo que dejaba una fila sola
  // por página). Salvaguarda además de la reserva de espacio ya hecha antes
  // de llamar a esta función.
  const TABLE_HEIGHT = 18 + DIMENSION_CODES.length * 16;
  if (y + TABLE_HEIGHT > CONTENT_BOTTOM) {
    doc.addPage();
    y = doc.y;
  }
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#FFFFFF");
  doc.rect(x, y, colW[0] + colW[1] + colW[2], 18).fill(ACCENT);
  doc.fillColor("#FFFFFF");
  doc.text(headers[0], x + 4, y + 5, { width: colW[0] - 8 });
  doc.text(headers[1], x + colW[0] + 4, y + 5, { width: colW[1] - 8 });
  doc.text(headers[2], x + colW[0] + colW[1] + 4, y + 5, { width: colW[2] - 8 });
  y += 18;
  DIMENSION_CODES.forEach((code, i) => {
    const d = dims[code];
    const bandText = { f: T(lang, "Fortaleza", "Strength"), m: T(lang, "Funcional", "Functional"), d: T(lang, "Área de desarrollo", "Area for development") }[d.band];
    if (i % 2 === 0) doc.rect(x, y, colW[0] + colW[1] + colW[2], 16).fill("#F4EDE8");
    doc.fillColor(INK).font("Helvetica").fontSize(9);
    doc.text(dimensionLabel(code, lang), x + 4, y + 4, { width: colW[0] - 8 });
    doc.text(String(d.index), x + colW[0] + 4, y + 4, { width: colW[1] - 8 });
    doc.fillColor(BAND_COLOR[d.band]).font("Helvetica-Bold").text(bandText, x + colW[0] + colW[1] + 4, y + 4, { width: colW[2] - 8 });
    y += 16;
  });
  doc.y = y + 10;
  doc.x = PAGE_MARGIN;
}

function coverPage(doc, lang, participant) {
  const W = 612;
  doc.rect(0, 0, W, 792).fill("#FFFFFF");

  // Franjas de marca arriba y abajo — le dan a la portada un acabado más
  // cuidado que una hoja en blanco lisa.
  doc.rect(0, 0, W, 7).fill(ACCENT);
  doc.rect(0, 785, W, 7).fill(ACCENT);

  // Logo
  try {
    doc.image(LOGO_PATH, W / 2 - 105, 46, { width: 210 });
  } catch (e) {
    doc.fontSize(28).fillColor(ACCENT).font("Helvetica-Bold").text("RelateReady", 0, 60, { align: "center" });
  }

  // Slogan — fuente más grande y en color de marca (antes era gris pequeño).
  // En español usa la misma traducción íntegra que el sitio web (antes
  // mezclaba "Ready Within. Ready Together" en inglés con el resto en
  // español); en inglés coincide con el slogan del sitio.
  doc
    .fontSize(12.5)
    .fillColor(ACCENT)
    .font("Helvetica-Oblique")
    .text(
      T(
        lang,
        "Listos por dentro. Listos en pareja: la preparación empieza contigo, no con la otra persona.",
        "Ready Within. Ready Together — readiness starts with you, not the other person."
      ),
      70,
      122,
      { align: "center", width: W - 140 }
    );
  doc.font("Helvetica");

  // Título del informe = nombre oficial del índice.
  doc.fontSize(16.5).fillColor(ACCENT).font("Helvetica-Bold").text(INDEX_NAME[lang] || INDEX_NAME.es, 66, 163, {
    align: "center",
    width: W - 132,
  });
  doc.font("Helvetica");

  doc.moveTo(W / 2 - 55, 191).lineTo(W / 2 + 55, 191).strokeColor(ACCENT).lineWidth(1.2).stroke();

  // Insignia "Informe Extendido" / "Preview gratuito", como una píldora de color.
  const badgeText = T(lang, "INFORME EXTENDIDO", "EXTENDED REPORT");
  doc.fontSize(9.5).font("Helvetica-Bold");
  const badgeTextWidth = doc.widthOfString(badgeText);
  const badgeW = badgeTextWidth + 28;
  const badgeH = 20;
  const badgeX = W / 2 - badgeW / 2;
  const badgeY = 202;
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 10).fill(ACCENT);
  doc.fillColor("#FFFFFF").text(badgeText, badgeX, badgeY + 5.5, { width: badgeW, align: "center" });
  doc.font("Helvetica").fillColor(INK);

  // Ilustración de marca, misma imagen que la portada del sitio web. Ver
  // illustration() arriba para agregar más en el futuro.
  illustration(doc, HERO_HOME_PATH, (W - 380) / 2, 240, 380);

  // Nombre del participante y fecha — fuente más grande y prominente.
  doc.fontSize(19).fillColor(INK).font("Helvetica-Bold").text(`${participant.name}`, 66, 472, { align: "center", width: W - 132 });
  doc.font("Helvetica");
  doc
    .fontSize(11.5)
    .fillColor(MUTED)
    .text(
      `${T(lang, "Informe generado el", "Report generated on")} ${new Date().toLocaleDateString(lang === "en" ? "en-US" : "es-EC")}`,
      66,
      500,
      { align: "center", width: W - 132 }
    );

  doc.moveTo(W / 2 - 40, 526).lineTo(W / 2 + 40, 526).strokeColor("#DDD6CE").lineWidth(1).stroke();
  // "Desarrollado por" + el logotipo real de Adamantine (no el nombre en
  // texto), igual que en el pie de página de las páginas de contenido.
  developedByLockup(doc, lang, W / 2, 540, 10, 24);

  // Nota de confidencialidad — deja claro que el informe es un documento
  // personal y no debe circular sin autorización del titular.
  doc
    .fontSize(8.5)
    .fillColor(MUTED)
    .font("Helvetica-Oblique")
    .text(
      T(
        lang,
        `Documento confidencial. Preparado exclusivamente para uso personal de ${participant.name}; su contenido no debe compartirse, publicarse ni distribuirse sin su autorización.`,
        `Confidential document. Prepared exclusively for the personal use of ${participant.name}; its contents should not be shared, published, or distributed without their authorization.`
      ),
      86,
      568,
      { align: "center", width: W - 172 }
    );
  doc.font("Helvetica");
}

function introPage(doc, lang, participant) {
  doc.addPage();
  h1(doc, T(lang, "Introducción", "Introduction"));
  body(
    doc,
    T(
      lang,
      `Hola ${participant.name}. Este informe no busca decirte si eres "apto" o "no apto" para el amor — nadie lo es de una vez y para siempre. Busca mostrarte, con la mayor honestidad posible, qué patrones aprendidos tienes ya consolidados como fortalezas, y en cuáles conviene poner atención antes o durante tu próximo vínculo. Tómalo como un mapa, no como una sentencia.`,
      `Hi ${participant.name}. This report isn't here to tell you whether you're "fit" or "unfit" for love — no one is, once and for all. It's here to show you, as honestly as possible, which learned patterns you already have solidly built as strengths, and which ones are worth paying attention to before or during your next relationship. Think of it as a map, not a verdict.`
    )
  );
}

function referralClosePage(doc, lang) {
  const message = T(lang, REFERRAL_MESSAGE.es, REFERRAL_MESSAGE.en);
  // El mensaje de derivación es largo (varios párrafos): reservamos espacio
  // según su altura real, no un número fijo, para que el título "Un mensaje
  // importante" nunca quede solo al final de una página sin el texto debajo.
  doc.fontSize(10.5).font("Helvetica-Oblique");
  const msgHeight = doc.heightOfString(message, { width: 612 - PAGE_MARGIN * 2 - 14, lineGap: 3 });
  doc.font("Helvetica");
  ensureSpace(doc, 55 + msgHeight + 16);
  h1(doc, T(lang, "Un mensaje importante", "An important message"));
  aiBlock(doc, message);
}

// Página de cierre del Informe Extendido: metodología + disclaimer estándar.
// (El preview gratuito ya no existe como PDF descargable — la experiencia
// gratuita real es la pantalla de resultados del sitio, con las 8
// dimensiones. Ver services/pdfGenerator.js más abajo.)
function standardClosePage(doc, lang) {
  ensureSpace(doc, 160);
  h1(doc, T(lang, "Metodología y cierre", "Methodology and closing"));
  body(
    doc,
    T(
      lang,
      `RelateReady es una herramienta de autoconocimiento basada en el ${INDEX_NAME.es}, y no sustituye el diagnóstico ni el tratamiento de un profesional de salud mental. Los ítems y el algoritmo de puntuación son de autoría original de Adamantine.`,
      `RelateReady is a self-knowledge tool based on the ${INDEX_NAME.en}, and does not replace the diagnosis or treatment of a mental health professional. The items and scoring algorithm are original work by Adamantine.`
    )
  );
}

async function generateExtendedReportPDF({ participant, scoreResult, referral, aiSections, qualitativeAnswers }) {
  const lang = participant.lang;
  const doc = newDoc();
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  coverPage(doc, lang, participant);
  introPage(doc, lang, participant);

  ensureSpace(doc, 160); // reserva espacio solo para título + párrafo intro
  h1(doc, T(lang, "Cómo leer tu perfil", "How to read your profile"));
  body(
    doc,
    T(
      lang,
      "RelateReady no te da una sola nota. Te muestra tu preparación en 8 áreas distintas de la vida en pareja, cada una con su propio resultado.",
      "RelateReady doesn't give you a single score. It shows your readiness across 8 different areas of relationship life, each with its own result."
    )
  );
  doc.moveDown(0.5);
  ensureSpace(doc, 190); // reserva espacio solo para el título + grilla de íconos
  h2(doc, T(lang, "Tus 8 pilares", "Your 8 pillars"));
  dimensionIconsGrid(doc, lang);

  ensureSpace(doc, 460); // reserva espacio solo para el bloque radar + tabla
  drawRadarChart(doc, 306, doc.y + 150, 95, scoreResult.dimensions, lang);
  doc.y += 300;
  supportTable(doc, scoreResult.dimensions, lang);

  // Lectura integral (IA)
  ensureSpace(doc, 220);
  h1(doc, T(lang, "Lectura integral de tu perfil", "Integral reading of your profile"));
  aiBlock(doc, aiSections.integralReading);

  // Fortalezas
  ensureSpace(doc, 220);
  h1(doc, T(lang, "Tus fortalezas principales", "Your top strengths"));
  aiBlock(doc, aiSections.strengthsSynthesis);
  scoreResult.topStrengths.forEach((code) => {
    const band = scoreResult.dimensions[code].band;
    const bc = getBandContent(code, band, lang, participant.gender);
    ensureSpace(doc, 90);
    h2(doc, `${dimensionLabel(code, lang)} — ${bc.bandLabel}`, BAND_COLOR[band]);
    body(doc, bc.text);
  });

  // Áreas de desarrollo
  ensureSpace(doc, 220);
  h1(doc, T(lang, "Tus áreas de desarrollo prioritarias", "Your priority development areas"));
  aiBlock(doc, aiSections.developmentSynthesis);
  scoreResult.topDevelopmentAreas.forEach((code) => {
    const band = scoreResult.dimensions[code].band;
    const bc = getBandContent(code, band, lang, participant.gender);
    ensureSpace(doc, 120);
    h2(doc, `${dimensionLabel(code, lang)} — ${bc.bandLabel}`, BAND_COLOR[band]);
    body(doc, bc.text);
    if (band === "d") bulletList(doc, bc.recommendations);
  });

  // Síntesis general
  ensureSpace(doc, 200);
  h1(doc, T(lang, "Síntesis general", "Overall synthesis"));
  aiBlock(doc, aiSections.overallSynthesis);

  if (scoreResult.desirability.flag) {
    note(doc, T(lang, SOCIAL_DESIRABILITY_NOTE.es, SOCIAL_DESIRABILITY_NOTE.en));
  }

  // Detalle completo de las 8 dimensiones
  ensureSpace(doc, 260);
  h1(doc, T(lang, "Detalle completo de tus 8 dimensiones", "Full detail of your 8 dimensions"));
  DIMENSION_CODES.forEach((code) => {
    const band = scoreResult.dimensions[code].band;
    const bc = getBandContent(code, band, lang, participant.gender);
    ensureSpace(doc, 110);
    h2WithIcon(doc, DIMENSION_ICON_PATH[code], `${dimensionLabel(code, lang)} — ${bc.bandLabel} (${scoreResult.dimensions[code].index}/100)`, BAND_COLOR[band]);
    body(doc, bc.text);
    if (band === "d") bulletList(doc, bc.recommendations);
  });

  // Plan de acción a 3 semanas + invitación a la sesión de mentoría gratuita
  ensureSpace(doc, 320);
  h1(doc, T(lang, "Tu plan de acción a 3 semanas", "Your 3-week action plan"));
  aiBlock(doc, aiSections.actionPlanNarrative);
  ensureSpace(doc, 90);
  h2(doc, T(lang, "Tu sesión de mentoría indagatoria gratuita", "Your free intake mentoring session"));
  body(
    doc,
    T(
      lang,
      `Como parte de tu Informe Extendido, tienes una sesión de mentoría indagatoria GRATUITA de 60 minutos con ${MENTOR_NAME.es} para revisar juntos este plan y tus resultados.`,
      `As part of your Extended Report, you have a FREE 60-minute intake mentoring session with ${MENTOR_NAME.en} to review this plan and your results together.`
    )
  );
  linkButton(doc, T(lang, "Agendar mi sesión gratuita", "Schedule my free session"), BOOKING_LINKS[lang] || BOOKING_LINKS.es);
  bookTeaserBlock(doc, lang);

  if (referral.triggered) {
    referralClosePage(doc, lang);
  } else {
    standardClosePage(doc, lang);
  }

  drawHeaderFooter(doc, lang);
  doc.end();
  return done;
}

module.exports = { generateExtendedReportPDF };
