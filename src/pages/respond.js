import { supabase } from "../supabaseClient.js";
import { topbarHTML } from "../components/topbar.js";
import { uploadPhoto } from "../utils/uploadPhoto.js";
import { escapeHtml } from "../utils/html.js";
import { shuffle } from "../utils/shuffle.js";

export async function renderRespond(app, code) {
  app.innerHTML = `${topbarHTML("Quiz e Domande")}<main class="container"><div class="spinner">Caricamento...</div></main>`;

  const { data: questionnaire, error: qErr } = await supabase
    .from("questionnaires")
    .select("*")
    .eq("share_code", code.toUpperCase())
    .eq("is_active", true)
    .maybeSingle();

  if (qErr || !questionnaire) {
    app.querySelector("main").innerHTML = `
      <div class="card empty-state">
        <p>Questionario non trovato o non piu' attivo.</p>
        <a class="btn secondary" href="#/">Torna alla home</a>
      </div>
    `;
    return;
  }

  let { data: questions } = await supabase
    .from("questions")
    .select("*, question_options(*)")
    .eq("questionnaire_id", questionnaire.id)
    .order("order_index", { ascending: true });

  questions = questions || [];
  questions.forEach((q) => {
    q.question_options.sort((a, b) => a.order_index - b.order_index);
  });

  const SUBSET_SIZE = 10;
  if (questionnaire.random_subset_enabled) {
    questions = shuffle(questions).slice(0, Math.min(SUBSET_SIZE, questions.length));
  } else if (questionnaire.randomize_questions) {
    questions = shuffle(questions);
  }

  const state = {
    step: "gate",
    name: "",
    matricola: "",
    answers: {}, // question_id -> value shape depends on type
  };

  renderGate();

  function renderGate() {
    app.innerHTML = `
      ${topbarHTML(questionnaire.title)}
      <main class="container">
        <div class="card">
          ${questionnaire.description ? `<p class="hint">${escapeHtml(questionnaire.description)}</p>` : ""}
          <label for="name">Nome e cognome</label>
          <input id="name" type="text" autocomplete="name" placeholder="Es. Mario Rossi" />
          <label for="matricola">Numero di matricola (5 cifre)</label>
          <input id="matricola" type="tel" inputmode="numeric" maxlength="5" placeholder="Es. 01234" />
          <div id="gateErr" class="error" style="display:none"></div>
          <button class="btn" id="startBtn">Inizia il questionario</button>
        </div>
      </main>
    `;

    const nameInput = app.querySelector("#name");
    const matInput = app.querySelector("#matricola");
    const gateErr = app.querySelector("#gateErr");

    matInput.addEventListener("input", () => {
      matInput.value = matInput.value.replace(/\D/g, "").slice(0, 5);
    });

    app.querySelector("#startBtn").addEventListener("click", () => {
      const name = nameInput.value.trim();
      const matricola = matInput.value.trim();
      if (!name) {
        showGateErr("Inserisci il tuo nome e cognome.");
        return;
      }
      if (!/^\d{5}$/.test(matricola)) {
        showGateErr("Il numero di matricola deve avere esattamente 5 cifre.");
        return;
      }
      state.name = name;
      state.matricola = matricola;
      state.step = "form";
      renderForm();
    });

    function showGateErr(msg) {
      gateErr.textContent = msg;
      gateErr.style.display = "block";
    }
  }

  function renderForm() {
    const list = questions || [];

    list.forEach((q) => {
      if (q.type === "reorder" && !state.answers[q.id]) {
        state.answers[q.id] = shuffle(q.question_options.map((o) => o.id));
      }
    });

    if (list.length === 0) {
      app.innerHTML = `
        ${topbarHTML(questionnaire.title)}
        <main class="container">
          <div class="card empty-state">Questo questionario non ha ancora domande.</div>
        </main>
      `;
      return;
    }

    app.innerHTML = `
      ${topbarHTML(questionnaire.title)}
      <main class="container">
        <div class="card">
          <form id="quizForm">
            ${list.map((q, i) => questionBlockHTML(q, i)).join("")}
            <div id="formErr" class="error" style="display:none"></div>
            <button type="submit" class="btn" id="submitBtn">Invia risposte</button>
          </form>
        </div>
      </main>
    `;

    wireQuestionEvents(list);

    app.querySelector("#quizForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const missing = list.find((q) => q.required && !hasAnswer(q));
      const formErr = app.querySelector("#formErr");
      if (missing) {
        formErr.textContent = "Rispondi a tutte le domande obbligatorie prima di inviare.";
        formErr.style.display = "block";
        const idx = list.indexOf(missing);
        app.querySelectorAll(".question-block")[idx].scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      formErr.style.display = "none";
      const submitBtn = app.querySelector("#submitBtn");
      submitBtn.disabled = true;
      submitBtn.textContent = "Invio in corso...";
      try {
        const submittedAt = await submitResponses(list);
        renderThankYou(list, submittedAt);
      } catch (err) {
        formErr.textContent = "Si e' verificato un errore nell'invio. Riprova.";
        formErr.style.display = "block";
        submitBtn.disabled = false;
        submitBtn.textContent = "Invia risposte";
        console.error(err);
      }
    });
  }

  function hasAnswer(q) {
    const a = state.answers[q.id];
    if (q.type === "open") return !!(a && a.trim());
    if (q.type === "single_choice") return !!a;
    if (q.type === "multiple_choice") return !!(a && a.size > 0);
    if (q.type === "true_false") return a === true || a === false;
    if (q.type === "photo") return !!a;
    if (q.type === "reorder") return Array.isArray(a) && a.length === q.question_options.length;
    return false;
  }

  function questionBlockHTML(q, i) {
    const img = q.image_url ? `<img class="question-image" src="${q.image_url}" alt="" />` : "";
    let control = "";
    if (q.type === "open") {
      control = `<textarea data-qid="${q.id}" data-kind="open" placeholder="Scrivi qui la tua risposta..."></textarea>`;
    } else if (q.type === "single_choice") {
      control = q.question_options
        .map(
          (o) => `
        <label class="option-row">
          <input type="radio" name="q_${q.id}" data-qid="${q.id}" data-kind="single" value="${o.id}" />
          <div><div>${escapeHtml(o.text)}</div>${o.note ? `<span class="option-note">${escapeHtml(o.note)}</span>` : ""}</div>
        </label>`
        )
        .join("");
    } else if (q.type === "multiple_choice") {
      control = q.question_options
        .map(
          (o) => `
        <label class="option-row">
          <input type="checkbox" data-qid="${q.id}" data-kind="multiple" value="${o.id}" />
          <div><div>${escapeHtml(o.text)}</div>${o.note ? `<span class="option-note">${escapeHtml(o.note)}</span>` : ""}</div>
        </label>`
        )
        .join("");
    } else if (q.type === "true_false") {
      control = `
        <div class="true-false-row" data-qid="${q.id}" data-kind="truefalse">
          <button type="button" data-value="true">Vero</button>
          <button type="button" data-value="false">Falso</button>
        </div>`;
    } else if (q.type === "photo") {
      control = `
        <input type="file" accept="image/*" capture="environment" data-qid="${q.id}" data-kind="photo" />
        <div class="hint" data-status-for="${q.id}"></div>
        <img class="photo-preview" data-preview-for="${q.id}" style="display:none" />`;
    } else if (q.type === "reorder") {
      control = `<div class="reorder-list" data-kind="reorder" data-qid="${q.id}">${reorderItemsHTML(q)}</div>`;
    }

    return `
      <div class="question-block">
        <div class="question-index">Domanda ${i + 1}${q.required ? "" : " (facoltativa)"}</div>
        <p class="question-text">${escapeHtml(q.text)}</p>
        ${img}
        ${control}
      </div>
    `;
  }

  function reorderItemsHTML(q) {
    const order = state.answers[q.id] || [];
    return order
      .map((optionId, idx) => {
        const opt = q.question_options.find((o) => o.id === optionId);
        if (!opt) return "";
        return `
        <div class="reorder-item" data-option-id="${opt.id}">
          <span class="reorder-index">${idx + 1}</span>
          <span class="reorder-text">${escapeHtml(opt.text)}</span>
          <div class="reorder-controls">
            <button type="button" data-move="up" data-qid="${q.id}" data-option-id="${opt.id}" ${idx === 0 ? "disabled" : ""} aria-label="Sposta su">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 15l6-6 6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button type="button" data-move="down" data-qid="${q.id}" data-option-id="${opt.id}" ${idx === order.length - 1 ? "disabled" : ""} aria-label="Sposta giu'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>`;
      })
      .join("");
  }

  function wireReorderList(q) {
    const container = app.querySelector(`.reorder-list[data-qid="${q.id}"]`);
    if (!container) return;
    container.innerHTML = reorderItemsHTML(q);
    container.querySelectorAll("[data-move]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const order = state.answers[q.id];
        const idx = order.indexOf(btn.dataset.optionId);
        const delta = btn.dataset.move === "up" ? -1 : 1;
        const targetIdx = idx + delta;
        if (targetIdx < 0 || targetIdx >= order.length) return;
        [order[idx], order[targetIdx]] = [order[targetIdx], order[idx]];
        wireReorderList(q);
      });
    });
  }

  function wireQuestionEvents(list) {
    list
      .filter((q) => q.type === "reorder")
      .forEach((q) => wireReorderList(q));


    app.querySelectorAll('[data-kind="open"]').forEach((el) => {
      el.addEventListener("input", () => {
        state.answers[el.dataset.qid] = el.value;
      });
    });

    app.querySelectorAll('[data-kind="single"]').forEach((el) => {
      el.addEventListener("change", () => {
        state.answers[el.dataset.qid] = el.value;
      });
    });

    app.querySelectorAll('[data-kind="multiple"]').forEach((el) => {
      el.addEventListener("change", () => {
        const qid = el.dataset.qid;
        if (!state.answers[qid]) state.answers[qid] = new Set();
        if (el.checked) state.answers[qid].add(el.value);
        else state.answers[qid].delete(el.value);
      });
    });

    app.querySelectorAll('[data-kind="truefalse"]').forEach((wrap) => {
      const qid = wrap.dataset.qid;
      wrap.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.answers[qid] = btn.dataset.value === "true";
          wrap.querySelectorAll("button").forEach((b) => b.classList.remove("selected"));
          btn.classList.add("selected");
        });
      });
    });

    app.querySelectorAll('[data-kind="photo"]').forEach((el) => {
      el.addEventListener("change", async () => {
        const qid = el.dataset.qid;
        const file = el.files[0];
        if (!file) return;
        const status = app.querySelector(`[data-status-for="${qid}"]`);
        const preview = app.querySelector(`[data-preview-for="${qid}"]`);
        status.textContent = "Caricamento foto...";
        el.disabled = true;
        try {
          const url = await uploadPhoto(file, `answers/${questionnaire.id}`);
          state.answers[qid] = url;
          status.textContent = "Foto caricata.";
          preview.src = url;
          preview.style.display = "block";
        } catch (err) {
          status.textContent = "Errore nel caricamento della foto, riprova.";
          console.error(err);
        } finally {
          el.disabled = false;
        }
      });
    });
  }

  async function submitResponses(list) {
    const { data: response, error: respErr } = await supabase
      .from("responses")
      .insert({
        questionnaire_id: questionnaire.id,
        respondent_name: state.name,
        matricola: state.matricola,
      })
      .select()
      .single();
    if (respErr) throw respErr;

    for (const q of list) {
      const a = state.answers[q.id];
      if (a === undefined || a === null || a === "") continue;

      if (q.type === "open") {
        await supabase.from("answers").insert({
          response_id: response.id,
          question_id: q.id,
          answer_text: a,
        });
      } else if (q.type === "true_false") {
        await supabase.from("answers").insert({
          response_id: response.id,
          question_id: q.id,
          answer_text: a ? "Vero" : "Falso",
        });
      } else if (q.type === "photo") {
        await supabase.from("answers").insert({
          response_id: response.id,
          question_id: q.id,
          photo_url: a,
        });
      } else if (q.type === "single_choice") {
        const { data: answer, error } = await supabase
          .from("answers")
          .insert({ response_id: response.id, question_id: q.id })
          .select()
          .single();
        if (error) throw error;
        await supabase.from("answer_options").insert({ answer_id: answer.id, option_id: a });
      } else if (q.type === "multiple_choice") {
        if (a.size === 0) continue;
        const { data: answer, error } = await supabase
          .from("answers")
          .insert({ response_id: response.id, question_id: q.id })
          .select()
          .single();
        if (error) throw error;
        const rows = Array.from(a).map((optionId) => ({ answer_id: answer.id, option_id: optionId }));
        await supabase.from("answer_options").insert(rows);
      } else if (q.type === "reorder") {
        const { data: answer, error } = await supabase
          .from("answers")
          .insert({ response_id: response.id, question_id: q.id })
          .select()
          .single();
        if (error) throw error;
        const rows = a.map((optionId, idx) => ({ answer_id: answer.id, option_id: optionId, position: idx }));
        await supabase.from("answer_options").insert(rows);
      }
    }

    return response.submitted_at;
  }

  function buildPdfItems(list) {
    return list.map((q) => {
      const a = state.answers[q.id];
      let answerText = "";
      let photoUrl = null;

      if (q.type === "open") {
        answerText = a || "";
      } else if (q.type === "true_false") {
        answerText = a === true ? "Vero" : a === false ? "Falso" : "";
      } else if (q.type === "photo") {
        photoUrl = a || null;
      } else if (q.type === "single_choice") {
        const opt = q.question_options.find((o) => o.id === a);
        answerText = opt ? opt.text : "";
      } else if (q.type === "multiple_choice") {
        const selected = a instanceof Set ? a : new Set();
        answerText = q.question_options
          .filter((o) => selected.has(o.id))
          .map((o) => o.text)
          .join(", ");
      } else if (q.type === "reorder") {
        const order = Array.isArray(a) ? a : [];
        answerText = order
          .map((optionId, idx) => {
            const opt = q.question_options.find((o) => o.id === optionId);
            return opt ? `${idx + 1}. ${opt.text}` : null;
          })
          .filter(Boolean)
          .join(", ");
      }

      return { questionText: q.text, answerText, photoUrl };
    });
  }

  function renderThankYou(list, submittedAt) {
    app.innerHTML = `
      ${topbarHTML(questionnaire.title)}
      <main class="container">
        <div class="card center">
          <h2>Grazie, ${escapeHtml(state.name)}!</h2>
          <p>Le tue risposte sono state inviate correttamente.</p>
          <button class="btn secondary" id="pdfBtn">Scarica PDF delle tue risposte</button>
          <a class="btn secondary" href="#/">Torna alla home</a>
        </div>
      </main>
    `;

    app.querySelector("#pdfBtn").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = "Genero il PDF...";
      try {
        const { downloadResponsePdf } = await import("../utils/pdf.js");
        await downloadResponsePdf({
          questionnaireTitle: questionnaire.title,
          respondentName: state.name,
          matricola: state.matricola,
          submittedAt,
          items: buildPdfItems(list),
        });
      } catch (err) {
        console.error(err);
        alert("Non e' stato possibile generare il PDF. Riprova.");
      } finally {
        btn.disabled = false;
        btn.textContent = "Scarica PDF delle tue risposte";
      }
    });
  }
}
