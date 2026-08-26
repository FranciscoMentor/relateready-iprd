// Generador de PDF (pdfkit) — Preview gratuito e Informe Extendido de RelateReady.
// Identidad de marca: ver IPRD_estructura_informe.docx (Fase D).
const PDFDocument = require("pdfkit");
const path = require("path");
const { dimensionLabel, DIMENSION_CODES } = require("../data/dimensions");
const { getBandContent, SOCIAL_DESIRABILITY_NOTE, REFERRAL_MESSAGE } = require("../data/reportContent");

const ACCENT = "#B5732A";
const INK = "#2A2A28";
const MUTED = "#6B6259";
const GREEN = "#3F6B4F";
const AMBER = "#9C6B14";
const CLAY = "#9C3B2E";
const CREAM = "#F4F0E9";

const BAND_COLOR = { f: GREEN, m: AMBER, d: CLAY };
const LOGO_PATH = path.join(__dirname, "..", "public", "assets", "relateready-logo.png");

const PAGE_MARGIN = 56;

function T(lang, es, en) {
  return lang === "en" ? en : es;
}

function newDoc() {
  return new PDFDocument({ size: "LETTER", margin: PAGE_MARGIN, bufferPages: true });
}

function drawHeaderFooter(doc, lang) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    if (i === 0) continue; // sin encabezado en la portada
    doc
      .fontSize(8)
      .fillColor(MUTED)
      .text(T(lang, "RELATEREADY · Índice de Preparación para Relaciones Duraderas (IPRD)", "RELATEREADY · Relationship Readiness Index (IPRD)"), PAGE_MARGIN, 28, {
        width: 612 - PAGE_MARGIN * 2 - 150,
        continued: false,
      });
    doc.fontSize(8).fillColor(MUTED).text("ADAMANTINE", 612 - PAGE_MARGIN - 150, 28, { width: 150, align: "right" });
    doc
      .fontSize(8)
      .fillColor(MUTED)
      .text(T(lang, "Desarrollado por Adamantine", "Developed by Adamantine"), PAGE_MARGIN, 760, { width: 612 - PAGE_MARGIN * 2, align: "center" });
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

function body(doc, text) {
  doc.fontSize(10.5).fillColor(INK).font("Helvetica").text(text, { align: "left", lineGap: 3 });
  doc.moveDown(0.4);
}

function note(doc, text) {
  doc.fontSize(9).fillColor(MUTED).font("Helvetica-Oblique").text(text, { lineGap: 2 });
  doc.moveDown(0.4);
  doc.font("Helvetica");
}

function bulletList(doc, items) {
  doc.fontSize(10.5).fillColor(INK).font("Helvetica");
  items.forEach((it) => {
    doc.text(`•  ${it}`, { indent: 10, lineGap: 3 });
  });
  doc.moveDown(0.4);
}

function aiBlock(doc, text) {
  const startX = doc.x;
  const startY = doc.y;
  doc.fontSize(10.5).fillColor(INK).font("Helvetica-Oblique");
  const textHeight = doc.heightOfString(text, { width: 612 - PAGE_MARGIN * 2 - 14 });
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
  [0.25, 0.5, 0.75, 1].forEach((frac) => {
    doc.save();
    doc.strokeColor("#DDD6CE").lineWidth(0.5);
    for (let i = 0; i <= n; i++) {
      const a = angleFor(i % n);
      const r = maxRadius * frac;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      if (i === 0) doc.moveTo(x, y);
      else doc.lineTo(x, y);
    }
    doc.stroke();
    doc.restore();
  });

  // Ejes + etiquetas
  DIMENSION_CODES.forEach((code, i) => {
    const a = angleFor(i);
    const x = cx + maxRadius * Math.cos(a);
    const y = cy + maxRadius * Math.sin(a);
    doc.save().strokeColor("#DDD6CE").lineWidth(0.5).moveTo(cx, cy).lineTo(x, y).stroke().restore();
    const labelX = cx + (maxRadius + 14) * Math.cos(a);
    const labelY = cy + (maxRadius + 14) * Math.sin(a);
    doc
      .fontSize(8)
      .fillColor(INK)
      .font("Helvetica-Bold")
      .text(code, labelX - 10, labelY - 4, { width: 20, align: "center" });
  });

  // Polígono de datos
  doc.save();
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
  doc.restore();
  doc.fillOpacity(1);
}

function supportTable(doc, dims, lang) {
  const headers = [T(lang, "Dimensión", "Dimension"), T(lang, "Índice", "Index"), T(lang, "Banda", "Band")];
  const colW = [260, 70, 140];
  let x = PAGE_MARGIN;
  let y = doc.y;
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

function coverPage(doc, lang, participant, level) {
  doc.rect(0, 0, 612, 792).fill("#FFFFFF");
  try {
    doc.image(LOGO_PATH, 612 / 2 - 130, 90, { width: 260 });
  } catch (e) {
    doc.fontSize(30).fillColor(ACCENT).font("Helvetica-Bold").text("RelateReady", 0, 120, { align: "center" });
  }
  doc.moveDown(6);
  doc
    .fontSize(9.5)
    .fillColor(MUTED)
    .font("Helvetica-Oblique")
    .text("Ready Within. Ready Together — la preparación empieza contigo, no con la otra persona.", PAGE_MARGIN, 210, {
      align: "center",
      width: 612 - PAGE_MARGIN * 2,
    });
  doc.font("Helvetica");
  doc.fontSize(13).fillColor(ACCENT).font("Helvetica-Bold").text(T(lang, "IPRD — Índice de Preparación para Relaciones Duraderas", "IPRD — Relationship Readiness Index"), PAGE_MARGIN, 260, {
    align: "center",
    width: 612 - PAGE_MARGIN * 2,
  });
  doc.moveDown(1);
  doc.fontSize(11).fillColor(INK).font("Helvetica").text(`${participant.name}`, { align: "center" });
  doc.fontSize(10).fillColor(MUTED).text(`${T(lang, "Informe generado el", "Report generated on")} ${new Date().toLocaleDateString(lang === "en" ? "en-US" : "es-EC")}`, { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor(MUTED).text(T(lang, "Desarrollado por Adamantine", "Developed by Adamantine"), { align: "center" });
  doc.moveDown(2);
  doc
    .fontSize(11)
    .fillColor(ACCENT)
    .font("Helvetica-Bold")
    .text(level === "extended" ? T(lang, "Informe Extendido", "Extended Report") : T(lang, "Preview gratuito", "Free preview"), { align: "center" });
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
  doc.addPage();
  h1(doc, T(lang, "Un mensaje importante", "An important message"));
  aiBlock(doc, T(lang, REFERRAL_MESSAGE.es, REFERRAL_MESSAGE.en));
}

function standardClosePage(doc, lang, level) {
  doc.addPage();
  h1(doc, T(lang, "Metodología y cierre", "Methodology and closing"));
  body(
    doc,
    T(
      lang,
      "RelateReady es una herramienta de autoconocimiento basada en el Índice de Preparación para Relaciones Duraderas (IPRD), y no sustituye el diagnóstico ni el tratamiento de un profesional de salud mental. Los ítems y el algoritmo de puntuación son de autoría original de Adamantine; las bandas de puntuación son PROVISIONALES y se irán refinando con más datos.",
      "RelateReady is a self-knowledge tool based on the Relationship Readiness Index (IPRD), and does not replace the diagnosis or treatment of a mental health professional. The items and scoring algorithm are original work by Adamantine; the scoring bands are PROVISIONAL and will be refined as more data becomes available."
    )
  );
  if (level !== "extended") {
    doc.moveDown(1);
    h2(doc, T(lang, "¿Quieres tu Informe Extendido?", "Want your Extended Report?"));
    body(
      doc,
      T(
        lang,
        "El Informe Extendido incluye el detalle completo de tus 8 dimensiones, tus áreas de desarrollo con recomendaciones concretas, cinco secciones narrativas generadas especialmente para ti por IA, y tu plan de acción a 90 días.",
        "The Extended Report includes the full detail of all 8 dimensions, your development areas with concrete recommendations, five narrative sections generated specifically for you by AI, and your 90-day action plan."
      )
    );
  }
}

/**
 * @returns {Buffer}
 */
async function generatePreviewPDF({ participant, scoreResult, referral }) {
  const lang = participant.lang;
  const doc = newDoc();
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  coverPage(doc, lang, participant, "preview");
  introPage(doc, lang, participant);

  doc.addPage();
  h1(doc, T(lang, "Cómo leer tu perfil", "How to read your profile"));
  body(
    doc,
    T(
      lang,
      "RelateReady no te da una sola nota. Te muestra tu preparación en 8 áreas distintas de la vida en pareja, cada una con su propio resultado. Vas a ver tres niveles posibles en cada una: Fortaleza, Funcional, y Área de desarrollo. Ninguno de los tres es un diagnóstico — son un punto de partida para saber en qué invertir tu energía.",
      "RelateReady doesn't give you a single score. It shows your readiness across 8 different areas of relationship life, each with its own result. You'll see three possible levels for each: Strength, Functional, and Area for development. None of the three is a diagnosis — they're a starting point for knowing where to invest your energy."
    )
  );
  doc.moveDown(0.5);
  drawRadarChart(doc, 306, doc.y + 110, 100, scoreResult.dimensions, lang);
  doc.y += 240;
  supportTable(doc, scoreResult.dimensions, lang);

  doc.addPage();
  const topCode = scoreResult.topStrengths[0];
  h1(doc, T(lang, "Tu fortaleza principal — muestra", "Your top strength — sample"));
  const bc = getBandContent(topCode, "f", lang, participant.gender);
  h2(doc, `${dimensionLabel(topCode, lang)} — ${bc.bandLabel}`, GREEN);
  body(doc, bc.text);
  note(
    doc,
    T(
      lang,
      "Esta es 1 de tus 8 dimensiones. El Informe Extendido incluye el detalle completo de las 8, tus áreas de desarrollo con recomendaciones, y las secciones narrativas generadas por IA especialmente para ti.",
      "This is 1 of your 8 dimensions. The Extended Report includes the full detail of all 8, your development areas with recommendations, and the AI-generated narrative sections written specifically for you."
    )
  );

  if (referral.triggered) {
    referralClosePage(doc, lang);
  } else {
    standardClosePage(doc, lang, "preview");
  }

  drawHeaderFooter(doc, lang);
  doc.end();
  return done;
}

async function generateExtendedReportPDF({ participant, scoreResult, referral, aiSections, qualitativeAnswers }) {
  const lang = participant.lang;
  const doc = newDoc();
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  coverPage(doc, lang, participant, "extended");
  introPage(doc, lang, participant);

  doc.addPage();
  h1(doc, T(lang, "Cómo leer tu perfil", "How to read your profile"));
  body(
    doc,
    T(
      lang,
      "RelateReady no te da una sola nota. Te muestra tu preparación en 8 áreas distintas de la vida en pareja, cada una con su propio resultado.",
      "RelateReady doesn't give you a single score. It shows your readiness across 8 different areas of relationship life, each with its own result."
    )
  );
  drawRadarChart(doc, 306, doc.y + 110, 100, scoreResult.dimensions, lang);
  doc.y += 240;
  supportTable(doc, scoreResult.dimensions, lang);

  // Página 4bis — Lectura integral (IA)
  doc.addPage();
  h1(doc, T(lang, "Lectura integral de tu perfil", "Integral reading of your profile"));
  aiBlock(doc, aiSections.integralReading);

  // Fortalezas
  doc.addPage();
  h1(doc, T(lang, "Tus fortalezas principales", "Your top strengths"));
  aiBlock(doc, aiSections.strengthsSynthesis);
  scoreResult.topStrengths.forEach((code) => {
    const band = scoreResult.dimensions[code].band;
    const bc = getBandContent(code, band, lang, participant.gender);
    h2(doc, `${dimensionLabel(code, lang)} — ${bc.bandLabel}`, BAND_COLOR[band]);
    body(doc, bc.text);
  });

  // Áreas de desarrollo
  doc.addPage();
  h1(doc, T(lang, "Tus áreas de desarrollo prioritarias", "Your priority development areas"));
  aiBlock(doc, aiSections.developmentSynthesis);
  scoreResult.topDevelopmentAreas.forEach((code) => {
    const band = scoreResult.dimensions[code].band;
    const bc = getBandContent(code, band, lang, participant.gender);
    h2(doc, `${dimensionLabel(code, lang)} — ${bc.bandLabel}`, BAND_COLOR[band]);
    body(doc, bc.text);
    if (band === "d") bulletList(doc, bc.recommendations);
  });

  // Síntesis general
  doc.addPage();
  h1(doc, T(lang, "Síntesis general", "Overall synthesis"));
  aiBlock(doc, aiSections.overallSynthesis);

  if (scoreResult.desirability.flag) {
    note(doc, T(lang, SOCIAL_DESIRABILITY_NOTE.es, SOCIAL_DESIRABILITY_NOTE.en));
  }

  // Detalle completo de las 8 dimensiones
  doc.addPage();
  h1(doc, T(lang, "Detalle completo de tus 8 dimensiones", "Full detail of your 8 dimensions"));
  DIMENSION_CODES.forEach((code) => {
    const band = scoreResult.dimensions[code].band;
    const bc = getBandContent(code, band, lang, participant.gender);
    h2(doc, `${dimensionLabel(code, lang)} — ${bc.bandLabel} (${scoreResult.dimensions[code].index}/100)`, BAND_COLOR[band]);
    body(doc, bc.text);
    if (band === "d") bulletList(doc, bc.recommendations);
    if (doc.y > 650) doc.addPage();
  });

  // Plan de acción a 90 días
  doc.addPage();
  h1(doc, T(lang, "Tu plan de acción a 90 días", "Your 90-day action plan"));
  aiBlock(doc, aiSections.actionPlanNarrative);

  if (referral.triggered) {
    referralClosePage(doc, lang);
  } else {
    standardClosePage(doc, lang, "extended");
  }

  drawHeaderFooter(doc, lang);
  doc.end();
  return done;
}

module.exports = { generatePreviewPDF, generateExtendedReportPDF };
