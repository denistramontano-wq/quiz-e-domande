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

  if (questionnaire.randomize_questions) {
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
        await submitResponses(list);
        renderThankYou();
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

  function wireQuestionEvents(list) {
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
      }
    }
  }

  function renderThankYou() {
    app.innerHTML = `
      ${topbarHTML(questionnaire.title)}
      <main class="container">
        <div class="card center">
          <h2>Grazie, ${escapeHtml(state.name)}!</h2>
          <p>Le tue risposte sono state inviate correttamente.</p>
          <a class="btn secondary" href="#/">Torna alla home</a>
        </div>
      </main>
    `;
  }
}
