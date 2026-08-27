(function () {
  "use strict";

  const I18N = {
    es: {
      slogan: "Listos por dentro. Listos en pareja: la preparación empieza contigo, no con la otra persona.",
      footer: "Desarrollado por Adamantine · Índice de Desarrollo y Fortalecimiento Relacional",
      intakeTitle: "Antes de empezar",
      intakeIntro: "RelateReady evalúa qué tan equipado/a estás — en términos de patrones emocionales y relacionales aprendidos — para sostener una relación sana en el tiempo. No predice compatibilidad con nadie en particular: mide tu propia preparación.",
      durationNote: "Este test toma entre 10 y 15 minutos.",
      nameLabel: "Tu nombre",
      genderLabel: "Género con el que te identificas",
      genderM: "Masculino",
      genderF: "Femenino",
      genderN: "Prefiero no especificar",
      genderNote: "Este dato es puramente gramatical (determina si el informe dice \"seguro\" o \"segura\") y no tiene relación con tu orientación sexual.",
      contextLabel: "¿En qué momento de tu vida amorosa estás?",
      contextTextLabel: "Cuéntanos en tus palabras qué te trae a hacer este test ahora",
      contextTextPlaceholder: "Escribe unas líneas...",
      requiredNote: "Todos los campos de esta página son obligatorios.",
      startBtn: "Comenzar",
      vignetteTitle: "Antes de las preguntas",
      vignetteIntro: "Estas 3 escenas no se puntúan — solo nos ayudan a darle un tono más cercano a tu informe.",
      nextBtn: "Siguiente",
      backBtn: "Atrás",
      itemsTitle: "Sobre ti y tus relaciones",
      itemsIntro: "Responde con lo primero que sientas verdadero, sin pensarlo demasiado.",
      itemsScaleNote: "Escala: 1 = totalmente en desacuerdo · 6 = totalmente de acuerdo.",
      likertLabels: ["Totalmente en desacuerdo", "En desacuerdo", "Algo en desacuerdo", "Algo de acuerdo", "De acuerdo", "Totalmente de acuerdo"],
      qualitativeTitle: "Para conocerte un poco más (opcional)",
      qualitativeIntro: "Estas 3 preguntas son opcionales y no se puntúan, pero enriquecen tu Informe Extendido.",
      submitBtn: "Ver mis resultados",
      submitting: "Calculando tu perfil...",
      resultsTitle: "Tu perfil RelateReady",
      resultsIntro: "Este es tu resultado en las 8 dimensiones del Índice de Desarrollo y Fortalecimiento Relacional.",
      extendedTitle: "¿Quieres el detalle completo?",
      extendedIntro: "El Informe Extendido incluye tus 8 dimensiones completas, recomendaciones concretas, 5 secciones escritas especialmente para ti por IA, y tu plan de acción a 3 semanas.",
      freeSessionNote: "Además, al adquirir tu Informe Extendido recibes una sesión de mentoría indagatoria gratuita de 60 minutos con el Dr. Francisco Rosero para revisarlo juntos.",
      scheduleSessionTitle: "Tu sesión de mentoría gratuita",
      scheduleSessionIntro: "Como parte de tu Informe Extendido, tienes una sesión de mentoría indagatoria gratuita de 60 minutos con el Dr. Francisco Rosero, Mentor en Relaciones y Desarrollo Personal, para revisar tus resultados.",
      scheduleSessionBtn: "Agendar mi sesión gratuita",
      payBtnLabel: "Desbloquear Informe Extendido",
      payBtnRealLabel: "Pagar Informe Extendido",
      simulatedTag: "simulado",
      payHint: "Se abrirá una pestaña nueva para completar el pago de forma segura con Payphone. Cuando termines, vuelve a esta pestaña.",
      verifyBtn: "Ya pagué — verificar",
      verifying: "Verificando...",
      paymentNotConfirmed: "Todavía no detectamos tu pago. Si ya completaste el pago hace unos segundos, espera un momento y vuelve a intentar.",
      paymentError: "No se pudo iniciar el pago. Intenta de nuevo en unos momentos.",
      paying: "Procesando...",
      downloadExtended: "Descargar mi Informe Extendido (PDF)",
      haveCode: "¿Tienes un código de acceso gratuito?",
      codePlaceholder: "Código de acceso",
      redeemBtn: "Canjear código",
      redeeming: "Verificando código...",
      codeInvalid: "Ese código no es válido.",
      referralNotice: "Tus respuestas sugieren que este podría ser un buen momento para hablar con alguien de confianza o un profesional de salud mental. RelateReady no es una herramienta de diagnóstico ni de crisis.",
      errorRequired: "Por favor completa todos los campos obligatorios.",
      progress: "Pregunta",
      of: "de",
      otherSpecify: "Especifica tu situación",
    },
    en: {
      slogan: "Ready Within. Ready Together — readiness starts with you, not the other person.",
      footer: "Developed by Adamantine · Relationship Development and Strengthening Index",
      intakeTitle: "Before you start",
      intakeIntro: "RelateReady assesses how well-equipped you are — in terms of learned emotional and relational patterns — to sustain a healthy relationship over time. It doesn't predict compatibility with anyone in particular: it measures your own readiness.",
      durationNote: "This test takes about 10–15 minutes.",
      nameLabel: "Your name",
      genderLabel: "Gender you identify with",
      genderM: "Male",
      genderF: "Female",
      genderN: "Prefer not to specify",
      genderNote: "This is purely a grammatical data point (in Spanish it determines phrasing) and has no relation to your sexual orientation.",
      contextLabel: "What point in your love life are you at?",
      contextTextLabel: "Tell us in your own words what brings you to take this test now",
      contextTextPlaceholder: "Write a few lines...",
      requiredNote: "All fields on this page are required.",
      startBtn: "Start",
      vignetteTitle: "Before the questions",
      vignetteIntro: "These 3 scenes aren't scored — they just help give your report a closer tone.",
      nextBtn: "Next",
      backBtn: "Back",
      itemsTitle: "About you and your relationships",
      itemsIntro: "Answer with the first thing that feels true, without overthinking it.",
      itemsScaleNote: "Scale: 1 = strongly disagree · 6 = strongly agree.",
      likertLabels: ["Strongly disagree", "Disagree", "Somewhat disagree", "Somewhat agree", "Agree", "Strongly agree"],
      qualitativeTitle: "To get to know you a bit more (optional)",
      qualitativeIntro: "These 3 questions are optional and unscored, but they enrich your Extended Report.",
      submitBtn: "See my results",
      submitting: "Calculating your profile...",
      resultsTitle: "Your RelateReady profile",
      resultsIntro: "This is your result across the 8 dimensions of the Relationship Development and Strengthening Index.",
      extendedTitle: "Want the full detail?",
      extendedIntro: "The Extended Report includes all 8 full dimensions, concrete recommendations, 5 sections written specifically for you by AI, and your 3-week action plan.",
      freeSessionNote: "Plus, getting your Extended Report includes a free 60-minute intake mentoring session with Dr. Francisco Rosero to review it together.",
      scheduleSessionTitle: "Your free mentoring session",
      scheduleSessionIntro: "As part of your Extended Report, you get a free 60-minute intake mentoring session with Dr. Francisco Rosero, Relationship & Personal Development Mentor, to review your results.",
      scheduleSessionBtn: "Schedule my free session",
      payBtnLabel: "Unlock Extended Report",
      payBtnRealLabel: "Pay for Extended Report",
      simulatedTag: "simulated",
      payHint: "A new tab will open to complete your payment securely with Payphone. When you're done, come back to this tab.",
      verifyBtn: "I already paid — verify",
      verifying: "Verifying...",
      paymentNotConfirmed: "We haven't detected your payment yet. If you just completed it, wait a moment and try again.",
      paymentError: "Couldn't start the payment. Please try again in a moment.",
      paying: "Processing...",
      downloadExtended: "Download my Extended Report (PDF)",
      haveCode: "Have a free access code?",
      codePlaceholder: "Access code",
      redeemBtn: "Redeem code",
      redeeming: "Checking code...",
      codeInvalid: "That code isn't valid.",
      referralNotice: "Your answers suggest this might be a good time to talk with someone you trust or a mental health professional. RelateReady is not a diagnostic or crisis tool.",
      errorRequired: "Please fill in all required fields.",
      progress: "Question",
      of: "of",
      otherSpecify: "Specify your situation",
    },
  };

  // Enlaces de agendamiento para la sesión de mentoría gratuita de 60 min
  // incluida con el Informe Extendido (uno por idioma). Si Francisco necesita
  // cambiarlos en el futuro, basta con actualizar estas dos URLs.
  const BOOKING_LINKS = {
    es: "https://outlook.office.com/owa/calendar/FranciscoRoseroMentor@ADAMANTINEHEALING.onmicrosoft.com/bookings/s/eMJ5GQhw_0W_-z2cJN-S9g2",
    en: "https://outlook.office.com/owa/calendar/FranciscoRoseroMentor@ADAMANTINEHEALING.onmicrosoft.com/bookings/s/K4DmDOt-kUSplfAlddYmbw2",
  };

  const state = {
    lang: "es",
    meta: null,
    step: "intake",
    name: "",
    gender: "",
    relationshipContextCode: "",
    relationshipContextText: "",
    vignetteResponses: {},
    coreResponses: {},
    desirabilityResponses: {},
    qualitativeAnswers: ["", "", ""],
    submissionId: null,
    scoreSummary: null,
    referralTriggered: false,
    paid: false,
  };

  const app = document.getElementById("app");
  function t(key) {
    return I18N[state.lang][key];
  }

  async function loadMeta() {
    const res = await fetch(`/api/meta?lang=${state.lang}`);
    state.meta = await res.json();
  }

  function setLang(lang) {
    state.lang = lang;
    document.getElementById("btn-es").classList.toggle("active", lang === "es");
    document.getElementById("btn-en").classList.toggle("active", lang === "en");
    document.querySelector('[data-i18n="footer"]').textContent = t("footer");
    document.querySelector('[data-i18n="slogan"]').textContent = t("slogan");
    loadMeta().then(render);
  }
  document.getElementById("btn-es").addEventListener("click", () => setLang("es"));
  document.getElementById("btn-en").addEventListener("click", () => setLang("en"));

  function render() {
    if (state.step === "intake") renderIntake();
    else if (state.step === "vignettes") renderVignettes();
    else if (state.step === "items") renderItems();
    else if (state.step === "qualitative") renderQualitative();
    else if (state.step === "results") renderResults();
  }

  // ---------------- INTAKE ----------------
  function renderIntake() {
    const ctxOptions = state.meta.relationshipContexts
      .map((c) => `<option value="${c.code}" ${state.relationshipContextCode === c.code ? "selected" : ""}>${c.label}</option>`)
      .join("");
    app.innerHTML = `
      <img src="/assets/hero-home.jpg" alt="RelateReady" class="hero-image" />
      <div class="card">
        <h1>${t("intakeTitle")}</h1>
        <p>${t("intakeIntro")}</p>
        <p class="muted">${t("durationNote")}</p>
        <label>${t("nameLabel")}</label>
        <input type="text" id="f-name" value="${escapeAttr(state.name)}" />

        <label>${t("genderLabel")}</label>
        <div class="radio-group">
          <label><input type="radio" name="gender" value="M" ${state.gender === "M" ? "checked" : ""}/> ${t("genderM")}</label>
          <label><input type="radio" name="gender" value="F" ${state.gender === "F" ? "checked" : ""}/> ${t("genderF")}</label>
          <label><input type="radio" name="gender" value="N" ${state.gender === "N" ? "checked" : ""}/> ${t("genderN")}</label>
        </div>
        <p class="muted">${t("genderNote")}</p>

        <label>${t("contextLabel")}</label>
        <select id="f-context-code">
          <option value="">—</option>
          ${ctxOptions}
        </select>

        <label>${t("contextTextLabel")}</label>
        <textarea id="f-context-text" placeholder="${t("contextTextPlaceholder")}">${escapeHtml(state.relationshipContextText)}</textarea>

        <p class="muted">${t("requiredNote")}</p>
        <div id="intake-error" class="error"></div>
        <div class="nav-buttons">
          <span></span>
          <button class="primary" id="btn-start">${t("startBtn")}</button>
        </div>
      </div>`;

    document.getElementById("btn-start").addEventListener("click", () => {
      const name = document.getElementById("f-name").value.trim();
      const gender = (document.querySelector('input[name="gender"]:checked') || {}).value;
      const contextCode = document.getElementById("f-context-code").value;
      const contextText = document.getElementById("f-context-text").value.trim();
      if (!name || !gender || !contextCode || !contextText) {
        document.getElementById("intake-error").textContent = t("errorRequired");
        return;
      }
      state.name = name;
      state.gender = gender;
      state.relationshipContextCode = contextCode;
      state.relationshipContextText = contextText;
      state.step = "vignettes";
      state.vignetteIndex = 0;
      render();
    });
  }

  // ---------------- VIGNETTES ----------------
  function renderVignettes() {
    const idx = state.vignetteIndex || 0;
    const v = state.meta.vignettes[idx];
    const opts = v.opciones
      .map(
        (o) => `<div class="vignette-option ${state.vignetteResponses[v.id] === o.key ? "selected" : ""}" data-key="${o.key}">${o.text}</div>`
      )
      .join("");
    app.innerHTML = `
      <div class="card">
        <h1>${t("vignetteTitle")}</h1>
        <p class="muted">${t("vignetteIntro")}</p>
        <div class="progress"><div style="width:${((idx + 1) / state.meta.vignettes.length) * 100}%"></div></div>
        <h2>${v.escenario}</h2>
        <p>${v.pregunta}</p>
        <div id="vignette-options">${opts}</div>
        <div class="nav-buttons">
          <button class="secondary" id="btn-back">${t("backBtn")}</button>
          <button class="primary" id="btn-next" ${state.vignetteResponses[v.id] ? "" : "disabled"}>${t("nextBtn")}</button>
        </div>
      </div>`;

    document.querySelectorAll(".vignette-option").forEach((el) => {
      el.addEventListener("click", () => {
        state.vignetteResponses[v.id] = el.dataset.key;
        renderVignettes();
      });
    });
    document.getElementById("btn-back").addEventListener("click", () => {
      if (idx === 0) {
        state.step = "intake";
      } else {
        state.vignetteIndex = idx - 1;
      }
      render();
    });
    document.getElementById("btn-next").addEventListener("click", () => {
      if (idx + 1 < state.meta.vignettes.length) {
        state.vignetteIndex = idx + 1;
      } else {
        state.step = "items";
        state.itemPage = 0;
      }
      render();
    });
  }

  // ---------------- ITEMS (core + desirability interleaved) ----------------
  function buildInterleavedItems() {
    const core = state.meta.coreItems;
    const des = state.meta.desirabilityItems;
    const combined = [];
    let desIdx = 0;
    core.forEach((item, i) => {
      combined.push({ ...item, kind: "core" });
      // Inserta un ítem de deseabilidad cada 8 ítems núcleo (posiciones 7,15,23,31,39,47),
      // repartidos a lo largo del test en vez de agrupados al final.
      if ((i + 1) % 8 === 0 && desIdx < des.length) {
        combined.push({ ...des[desIdx], kind: "des" });
        desIdx++;
      }
    });
    while (desIdx < des.length) {
      combined.push({ ...des[desIdx], kind: "des" });
      desIdx++;
    }
    return combined;
  }

  const ITEMS_PER_PAGE = 9;

  function renderItems() {
    const all = buildInterleavedItems();
    const totalPages = Math.ceil(all.length / ITEMS_PER_PAGE);
    const page = state.itemPage || 0;
    const pageItems = all.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

    const blocks = pageItems
      .map((item) => {
        const responses = item.kind === "core" ? state.coreResponses : state.desirabilityResponses;
        const current = responses[item.id];
        const scale = t("likertLabels")
          .map((label, i) => {
            const val = i + 1;
            return `<label class="${current === val ? "selected" : ""}">
              <input type="radio" name="item-${item.id}" value="${val}" ${current === val ? "checked" : ""} data-id="${item.id}" data-kind="${item.kind}" />
              <span>${val}</span>
            </label>`;
          })
          .join("");
        return `<div class="item-block">
          <div class="item-text">${item.text}</div>
          <div class="likert-scale">${scale}</div>
        </div>`;
      })
      .join("");

    const answeredOnPage = pageItems.every((item) => {
      const responses = item.kind === "core" ? state.coreResponses : state.desirabilityResponses;
      return responses[item.id] !== undefined;
    });

    app.innerHTML = `
      <div class="card">
        ${page === 0 ? `<img src="/assets/hero-home.jpg" alt="RelateReady" class="hero-image-small" />` : ""}
        <h1>${t("itemsTitle")}</h1>
        <p class="muted">${t("itemsIntro")}</p>
        <p class="scale-note">${t("itemsScaleNote")}</p>
        <div class="progress"><div style="width:${((page + 1) / totalPages) * 100}%"></div></div>
        <p class="muted">${t("progress")} ${page * ITEMS_PER_PAGE + 1}–${Math.min((page + 1) * ITEMS_PER_PAGE, all.length)} ${t("of")} ${all.length}</p>
        ${blocks}
        <div class="nav-buttons">
          <button class="secondary" id="btn-back">${t("backBtn")}</button>
          <button class="primary" id="btn-next" ${answeredOnPage ? "" : "disabled"}>${t("nextBtn")}</button>
        </div>
      </div>`;

    document.querySelectorAll('.likert-scale input[type="radio"]').forEach((input) => {
      input.addEventListener("change", () => {
        const { id, kind } = input.dataset;
        const responses = kind === "core" ? state.coreResponses : state.desirabilityResponses;
        responses[id] = Number(input.value);
        renderItems();
      });
    });
    document.getElementById("btn-back").addEventListener("click", () => {
      if (page === 0) {
        state.step = "vignettes";
        state.vignetteIndex = state.meta.vignettes.length - 1;
      } else {
        state.itemPage = page - 1;
      }
      render();
    });
    document.getElementById("btn-next").addEventListener("click", () => {
      if (page + 1 < totalPages) {
        state.itemPage = page + 1;
      } else {
        state.step = "qualitative";
      }
      render();
    });
  }

  // ---------------- QUALITATIVE (optional) ----------------
  function renderQualitative() {
    const qs = state.meta.qualitativeItems
      .map(
        (q, i) => `<label>${q.text}</label>
        <textarea id="qual-${i}">${escapeHtml(state.qualitativeAnswers[i] || "")}</textarea>`
      )
      .join("");
    app.innerHTML = `
      <div class="card">
        <h1>${t("qualitativeTitle")}</h1>
        <p class="muted">${t("qualitativeIntro")}</p>
        ${qs}
        <div id="submit-error" class="error"></div>
        <div class="nav-buttons">
          <button class="secondary" id="btn-back">${t("backBtn")}</button>
          <button class="primary" id="btn-submit">${t("submitBtn")}</button>
        </div>
      </div>`;

    document.getElementById("btn-back").addEventListener("click", () => {
      state.step = "items";
      render();
    });
    document.getElementById("btn-submit").addEventListener("click", async () => {
      state.qualitativeAnswers = state.meta.qualitativeItems.map((_, i) => document.getElementById(`qual-${i}`).value.trim());
      const btn = document.getElementById("btn-submit");
      btn.disabled = true;
      btn.textContent = t("submitting");
      try {
        const res = await fetch("/api/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: state.name,
            lang: state.lang,
            gender: state.gender,
            relationshipContextCode: state.relationshipContextCode,
            relationshipContextText: state.relationshipContextText,
            coreResponses: state.coreResponses,
            desirabilityResponses: state.desirabilityResponses,
            vignetteResponses: state.vignetteResponses,
            qualitativeAnswers: state.qualitativeAnswers,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error");
        state.submissionId = data.id;
        state.scoreSummary = data.scoreSummary;
        state.referralTriggered = data.referralTriggered;
        state.step = "results";
        render();
      } catch (err) {
        document.getElementById("submit-error").textContent = err.message;
        btn.disabled = false;
        btn.textContent = t("submitBtn");
      }
    });
  }

  // ---------------- RESULTS ----------------
  function drawRadar(canvas, dims, codes) {
    const ctx = canvas.getContext("2d");
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const maxR = Math.min(cx, cy) - 30;
    const n = codes.length;
    const angleFor = (i) => -Math.PI / 2 + i * ((2 * Math.PI) / n);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#DDD6CE";
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75, 1].forEach((frac) => {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = angleFor(i % n);
        const x = cx + maxR * frac * Math.cos(a);
        const y = cy + maxR * frac * Math.sin(a);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
    codes.forEach((code, i) => {
      const a = angleFor(i);
      const x = cx + maxR * Math.cos(a);
      const y = cy + maxR * Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = "#2B2420";
      ctx.font = "bold 11px sans-serif";
      const lx = cx + (maxR + 16) * Math.cos(a);
      const ly = cy + (maxR + 16) * Math.sin(a);
      ctx.textAlign = "center";
      ctx.fillText(code, lx, ly);
    });
    ctx.beginPath();
    codes.forEach((code, i) => {
      const a = angleFor(i);
      const r = maxR * (dims[code].index / 100);
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = "rgba(122,59,46,0.28)";
    ctx.fill();
    ctx.strokeStyle = "#7A3B2E";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function renderResults() {
    const dims = state.scoreSummary.dimensions;
    const codes = state.meta.dimensions.map((d) => d.code);
    const bandClass = { f: "band-f", m: "band-m", d: "band-d" };
    const bandLabel = { f: state.lang === "en" ? "Strength" : "Fortaleza", m: state.lang === "en" ? "Functional" : "Funcional", d: state.lang === "en" ? "Area for development" : "Área de desarrollo" };

    const rows = state.meta.dimensions
      .map((d) => {
        const dim = dims[d.code];
        return `<tr><td>${d.label}</td><td>${dim.index}</td><td class="${bandClass[dim.band]}">${bandLabel[dim.band]}</td></tr>`;
      })
      .join("");

    // Precio configurable desde Render (EXTENDED_PRICE_CENTS) — ver routes/api.js.
    const priceStr = ((state.meta.extendedPriceCents || 2499) / 100).toFixed(2);

    // Bloque de código de acceso gratuito (paneles de prueba) — visible en
    // cualquier modo de pago mientras no esté pagado. Ver FREE_ACCESS_CODES.
    const codeBlockHtml = `
      <div class="code-redeem">
        <button type="button" class="secondary" id="btn-toggle-code">${t("haveCode")}</button>
        <div id="code-form" style="display:none">
          <input type="text" id="f-code" placeholder="${t("codePlaceholder")}" />
          <button class="secondary" id="btn-redeem">${t("redeemBtn")}</button>
        </div>
        <p class="error" id="code-msg" style="display:none"></p>
      </div>`;

    // Bloque de agendamiento de la sesión de mentoría gratuita de 60 min,
    // incluida con el Informe Extendido — se muestra una vez pagado/liberado.
    const sessionBlockHtml = `
      <div class="session-block">
        <h2>${t("scheduleSessionTitle")}</h2>
        <p>${t("scheduleSessionIntro")}</p>
        <a class="primary" style="text-decoration:none;display:inline-block" href="${BOOKING_LINKS[state.lang] || BOOKING_LINKS.es}" target="_blank">${t("scheduleSessionBtn")}</a>
      </div>`;

    // El área de pago tiene 3 estados posibles: ya pagado (mostrar descarga
    // + agendamiento de la sesión gratuita), Payphone real activo (botón de
    // pago real + verificación manual de respaldo), o modo simulado (sin
    // Payphone configurado todavía).
    const payAreaHtml = state.paid
      ? `<a class="primary" style="text-decoration:none;display:inline-block" href="/api/report/extended/${state.submissionId}" target="_blank">${t("downloadExtended")}</a>
         ${sessionBlockHtml}`
      : state.meta.payphoneEnabled
      ? `<button class="primary" id="btn-pay">${t("payBtnRealLabel")} — $${priceStr}</button>
         <p class="hint">${t("payHint")}</p>
         <button class="secondary" id="btn-verify">${t("verifyBtn")}</button>
         <p class="error" id="pay-msg" style="display:none"></p>
         ${codeBlockHtml}`
      : `<button class="primary" id="btn-pay">${t("payBtnLabel")} — $${priceStr} (${t("simulatedTag")})</button>
         ${codeBlockHtml}`;

    app.innerHTML = `
      <div class="card">
        <h1>${t("resultsTitle")}</h1>
        <p>${t("resultsIntro")}</p>
        <canvas id="radarCanvas" width="360" height="360"></canvas>
        <table class="dim-table">
          <thead><tr><th>${state.lang === "en" ? "Dimension" : "Dimensión"}</th><th>${state.lang === "en" ? "Index" : "Índice"}</th><th>${state.lang === "en" ? "Band" : "Banda"}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${state.referralTriggered ? `<p class="error">${t("referralNotice")}</p>` : ""}
      </div>
      <div class="card">
        <img src="/assets/hero-home.jpg" alt="RelateReady" class="hero-image" />
        <h2>${t("extendedTitle")}</h2>
        <p>${t("extendedIntro")}</p>
        ${!state.paid ? `<p class="bonus-note">${t("freeSessionNote")}</p>` : ""}
        <div id="pay-area">${payAreaHtml}</div>
      </div>`;

    drawRadar(document.getElementById("radarCanvas"), dims, codes);

    if (state.paid) {
      // Ya está pagado — el enlace de descarga ya se muestra arriba, nada más que hacer.
    } else if (state.meta.payphoneEnabled) {
      document.getElementById("btn-pay").addEventListener("click", async (e) => {
        const btn = e.target;
        const msg = document.getElementById("pay-msg");
        msg.style.display = "none";
        btn.disabled = true;
        btn.textContent = t("paying");
        try {
          const res = await fetch(`/api/payment/prepare/${state.submissionId}`, { method: "POST" });
          const data = await res.json();
          if (!data.ok || !data.payWithCard) throw new Error(data.error || "prepare failed");
          window.open(data.payWithCard, "_blank");
        } catch (err) {
          msg.textContent = t("paymentError");
          msg.style.display = "block";
        } finally {
          btn.disabled = false;
          btn.textContent = `${t("payBtnRealLabel")} — $${priceStr}`;
        }
      });

      document.getElementById("btn-verify").addEventListener("click", async (e) => {
        const btn = e.target;
        const msg = document.getElementById("pay-msg");
        msg.style.display = "none";
        btn.disabled = true;
        btn.textContent = t("verifying");
        try {
          const res = await fetch(`/api/submission/${state.submissionId}/status`);
          const data = await res.json();
          if (data.paymentStatus === "paid" || data.paymentStatus === "simulated" || data.paymentStatus === "free") {
            state.paid = true;
            renderResults();
            return;
          }
          msg.textContent = t("paymentNotConfirmed");
          msg.style.display = "block";
        } catch (err) {
          msg.textContent = t("paymentError");
          msg.style.display = "block";
        }
        btn.disabled = false;
        btn.textContent = t("verifyBtn");
      });
    } else {
      document.getElementById("btn-pay").addEventListener("click", async (e) => {
        const btn = e.target;
        btn.disabled = true;
        btn.textContent = t("paying");
        const res = await fetch(`/api/payment/simulate/${state.submissionId}`, { method: "POST" });
        const data = await res.json();
        if (data.ok) {
          state.paid = true;
          renderResults();
        }
      });
    }

    // Código de acceso gratuito — disponible en cualquier modo mientras no esté pagado.
    if (!state.paid) {
      const toggleBtn = document.getElementById("btn-toggle-code");
      const codeForm = document.getElementById("code-form");
      toggleBtn.addEventListener("click", () => {
        codeForm.style.display = codeForm.style.display === "none" ? "block" : "none";
      });

      document.getElementById("btn-redeem").addEventListener("click", async (e) => {
        const btn = e.target;
        const codeMsg = document.getElementById("code-msg");
        const codeInput = document.getElementById("f-code");
        codeMsg.style.display = "none";
        btn.disabled = true;
        btn.textContent = t("redeeming");
        try {
          const res = await fetch(`/api/payment/redeem/${state.submissionId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: codeInput.value }),
          });
          const data = await res.json();
          if (data.ok) {
            state.paid = true;
            renderResults();
            return;
          }
          codeMsg.textContent = t("codeInvalid");
          codeMsg.style.display = "block";
        } catch (err) {
          codeMsg.textContent = t("codeInvalid");
          codeMsg.style.display = "block";
        }
        btn.disabled = false;
        btn.textContent = t("redeemBtn");
      });
    }
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function escapeAttr(s) {
    return escapeHtml(s);
  }

  // Al volver de la pestaña de pago de Payphone, la URL trae ?sid=<envío>
  // (y, si el pago se completó, también ?id=...&clientTransactionId=... que
  // añade Payphone). Reconstruye el estado a partir de esos parámetros.
  async function restoreFromPayphoneReturn() {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("sid");
    if (!sid) return false;

    const payphoneId = params.get("id");
    const clientTransactionId = params.get("clientTransactionId");
    history.replaceState({}, "", window.location.pathname); // limpia la URL

    if (payphoneId && clientTransactionId) {
      try {
        await fetch(`/api/payment/confirm/${sid}?id=${encodeURIComponent(payphoneId)}&clientTransactionId=${encodeURIComponent(clientTransactionId)}`);
      } catch (e) {
        console.error("No se pudo confirmar el pago:", e);
      }
    }

    const res = await fetch(`/api/submission/${sid}/status`);
    if (!res.ok) return false;
    const data = await res.json();
    state.submissionId = sid;
    state.lang = data.lang || state.lang;
    state.scoreSummary = data.scoreSummary;
    state.referralTriggered = data.referralTriggered;
    state.paid = data.paymentStatus === "paid" || data.paymentStatus === "simulated" || data.paymentStatus === "free";
    state.step = "results";
    return true;
  }

  restoreFromPayphoneReturn().then((restored) => {
    loadMeta().then(() => {
      document.getElementById("btn-es").classList.toggle("active", state.lang === "es");
      document.getElementById("btn-en").classList.toggle("active", state.lang === "en");
      render();
    });
  });
})();
