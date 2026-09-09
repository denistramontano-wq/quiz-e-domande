import { supabase } from "../supabaseClient.js";
import { topbarHTML } from "../components/topbar.js";
import { escapeHtml } from "../utils/html.js";
import { shuffle } from "../utils/shuffle.js";

const SUBSET_SIZE = 10;
const GREEN = "background:oklch(90% 0.07 155);border-color:oklch(55% 0.12 155);";
const RED = "background:oklch(90% 0.07 25);border-color:oklch(58% 0.19 25);";

export async function renderTraining(app, code) {
  app.innerHTML = `${topbarHTML("Allenamento")}<main class="container"><div class="spinner">Caricamento...</div></main>`;

  const { data: questionnaire, error: qErr } = await supabase
    .from("questionnaires")
    .select("*")
    .eq("share_code", code.toUpperCase())
    .eq("is_active", true)
    .maybeSingle();

  if (qErr || !questionnaire || !questionnaire.training_enabled) {
    app.querySelector("main").innerHTML = `
      <div class="card empty-state">
        <p>Modalita' allenamento non disponibile per questo questionario.</p>
        <a class="btn secondary" href="#/">Torna alla home</a>
      </div>
    `;
    return;
  }

  const { data: rawQuestions } = await supabase
    .from("training_questions")
    .select("*")
    .eq("questionnaire_id", questionnaire.id)
    .order("order_index", { ascending: true });

  const baseQuestions = (rawQuestions || []).filter((q) => q.type !== "photo");
  baseQuestions.forEach((q) => q.question_options.sort((a, b) => a.order_index - b.order_index));

  if (baseQuestions.length === 0) {
    app.querySelector("main").innerHTML = `
      <div class="card empty-state">
        <p>Questo questionario non ha ancora domande utilizzabili per l'allenamento.</p>
        <a class="btn secondary" href="#/">Torna alla home</a>
      </div>
    `;
    return;
  }

  function newSession() {
    let list = shuffle(baseQuestions);
    if (questionnaire.random_subset_enabled) {
      list = list.slice(0, Math.min(SUBSET_SIZE, list.length));
    }
    list = list.map((q) => ({
      ...q,
      question_options:
        q.type === "single_choice" || q.type === "multiple_choice" ? shuffle(q.question_options) : q.question_options,
    }));

    const s = { list, index: 0, answers: {}, checked: {}, correctness: {} };
    s.list.forEach((q) => {
      if (q.type === "reorder") s.answers[q.id] = shuffle(q.question_options.map((o) => o.id));
    });
    return s;
  }

  let session = newSession();

  function currentQuestion() {
    return session.list[session.index];
  }

  function isAnswered(q) {
    const a = session.answers[q.id];
    if (q.type === "open") return !!(a && a.trim());
    if (q.type === "single_choice") return !!a;
    if (q.type === "multiple_choice") return !!(a && a.size > 0);
    if (q.type === "true_false") return a === true || a === false;
    if (q.type === "reorder") return Array.isArray(a) && a.length === q.question_options.length;
    return false;
  }

  function correctAnswerLabel(q) {
    if (q.type === "true_false") {
      if (q.correct_boolean === true) return "Vero";
      if (q.correct_boolean === false) return "Falso";
      return null;
    }
    if (q.type === "open") return q.correct_answer_text || null;
    if (q.type === "single_choice" || q.type === "multiple_choice") {
      const opts = q.question_options.filter((o) => o.is_correct);
      return opts.length > 0 ? opts.map((o) => o.text).join(", ") : null;
    }
    if (q.type === "reorder") {
      return [...q.question_options]
        .sort((a, b) => a.order_index - b.order_index)
        .map((o, idx) => `${idx + 1}. ${o.text}`)
        .join("\n");
    }
    return null;
  }

  function evaluate(q) {
    const a = session.answers[q.id];
    if (q.type === "single_choice") {
      const correctOpt = q.question_options.find((o) => o.is_correct);
      if (!correctOpt) return null;
      return a === correctOpt.id;
    }
    if (q.type === "multiple_choice") {
      const correctIds = q.question_options.filter((o) => o.is_correct).map((o) => o.id);
      if (correctIds.length === 0) return null;
      const selected = a instanceof Set ? a : new Set();
      if (selected.size !== correctIds.length) return false;
      return correctIds.every((id) => selected.has(id));
    }
    if (q.type === "true_false") {
      if (q.correct_boolean !== true && q.correct_boolean !== false) return null;
      return a === q.correct_boolean;
    }
    if (q.type === "reorder") {
      const correctIds = [...q.question_options].sort((x, y) => x.order_index - y.order_index).map((o) => o.id);
      const given = Array.isArray(a) ? a : [];
      if (given.length !== correctIds.length) return false;
      return given.every((id, idx) => id === correctIds[idx]);
    }
    return null; // "open": nessuna valutazione automatica
  }

  renderQuestion();

  function controlHTML(q, checked) {
    const a = session.answers[q.id];

    if (q.type === "open") {
      return `<textarea id="openInput" placeholder="Scrivi qui la tua risposta..." ${checked ? "disabled" : ""}>${escapeHtml(a || "")}</textarea>`;
    }

    if (q.type === "single_choice" || q.type === "multiple_choice") {
      return q.question_options
        .map((o) => {
          const isSelected = q.type === "single_choice" ? a === o.id : a instanceof Set && a.has(o.id);
          let style = "";
          if (checked) {
            if (o.is_correct) style = GREEN;
            else if (isSelected) style = RED;
          }
          return `
          <label class="option-row" style="${style}">
            <input type="${q.type === "single_choice" ? "radio" : "checkbox"}" name="opt" data-opt="${o.id}" ${isSelected ? "checked" : ""} ${checked ? "disabled" : ""} />
            <div><div>${escapeHtml(o.text)}</div>${o.note ? `<span class="option-note">${escapeHtml(o.note)}</span>` : ""}</div>
          </label>`;
        })
        .join("");
    }

    if (q.type === "true_false") {
      const trueStyle = checked
        ? q.correct_boolean === true
          ? GREEN
          : a === true
            ? RED
            : ""
        : "";
      const falseStyle = checked
        ? q.correct_boolean === false
          ? GREEN
          : a === false
            ? RED
            : ""
        : "";
      return `
        <div class="true-false-row">
          <button type="button" data-value="true" class="${a === true ? "selected" : ""}" ${checked ? "disabled" : ""} style="${trueStyle}">Vero</button>
          <button type="button" data-value="false" class="${a === false ? "selected" : ""}" ${checked ? "disabled" : ""} style="${falseStyle}">Falso</button>
        </div>`;
    }

    if (q.type === "reorder") {
      const order = a || [];
      return `<div class="reorder-list">${order
        .map((optionId, idx) => {
          const opt = q.question_options.find((o) => o.id === optionId);
          if (!opt) return "";
          return `
          <div class="reorder-item">
            <span class="reorder-index">${idx + 1}</span>
            <span class="reorder-text">${escapeHtml(opt.text)}</span>
            <div class="reorder-controls">
              <button type="button" data-move="up" data-option-id="${opt.id}" ${idx === 0 || checked ? "disabled" : ""} aria-label="Sposta su">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 15l6-6 6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <button type="button" data-move="down" data-option-id="${opt.id}" ${idx === order.length - 1 || checked ? "disabled" : ""} aria-label="Sposta giu'">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
            </div>
          </div>`;
        })
        .join("")}</div>`;
    }

    return "";
  }

  function feedbackHTML(q) {
    const correctness = session.correctness[q.id];
    const refLabel = correctAnswerLabel(q);
    let badge = "";
    if (correctness === true) {
      badge = '<span class="badge" style="background:oklch(90% 0.07 155);color:oklch(30% 0.1 155);">Corretta</span>';
    } else if (correctness === false) {
      badge = '<span class="badge" style="background:oklch(90% 0.07 25);color:oklch(35% 0.12 25);">Errata</span>';
    } else if (q.type !== "open") {
      badge = '<span class="badge inactive">Nessuna risposta corretta impostata</span>';
    }
    const refHtml =
      refLabel && correctness !== true
        ? `<p class="hint" style="margin-top:8px;white-space:pre-line;">Risposta corretta: ${escapeHtml(refLabel)}</p>`
        : q.type === "open" && !refLabel
          ? `<p class="hint" style="margin-top:8px;">Nessuna risposta di riferimento impostata per questa domanda.</p>`
          : "";
    return `<div style="margin-top:12px;">${badge}${refHtml}</div>`;
  }

  function updateCheckBtn(q) {
    const btn = app.querySelector("#checkBtn");
    if (btn) btn.disabled = !isAnswered(q);
  }

  function wireControls(q, checked) {
    if (checked) return;
    if (q.type === "open") {
      app.querySelector("#openInput").addEventListener("input", (e) => {
        session.answers[q.id] = e.target.value;
        updateCheckBtn(q);
      });
    } else if (q.type === "single_choice") {
      app.querySelectorAll('#controlArea input[type="radio"]').forEach((el) => {
        el.addEventListener("change", () => {
          session.answers[q.id] = el.dataset.opt;
          updateCheckBtn(q);
        });
      });
    } else if (q.type === "multiple_choice") {
      app.querySelectorAll('#controlArea input[type="checkbox"]').forEach((el) => {
        el.addEventListener("change", () => {
          if (!(session.answers[q.id] instanceof Set)) session.answers[q.id] = new Set();
          const set = session.answers[q.id];
          if (el.checked) set.add(el.dataset.opt);
          else set.delete(el.dataset.opt);
          updateCheckBtn(q);
        });
      });
    } else if (q.type === "true_false") {
      app.querySelectorAll("#controlArea .true-false-row button").forEach((btn) => {
        btn.addEventListener("click", () => {
          session.answers[q.id] = btn.dataset.value === "true";
          renderQuestion();
        });
      });
    } else if (q.type === "reorder") {
      app.querySelectorAll("#controlArea [data-move]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const order = session.answers[q.id];
          const idx = order.indexOf(btn.dataset.optionId);
          const delta = btn.dataset.move === "up" ? -1 : 1;
          const targetIdx = idx + delta;
          if (targetIdx < 0 || targetIdx >= order.length) return;
          [order[idx], order[targetIdx]] = [order[targetIdx], order[idx]];
          renderQuestion();
        });
      });
    }
  }

  function renderQuestion() {
    const q = currentQuestion();
    const checked = !!session.checked[q.id];
    const total = session.list.length;

    app.innerHTML = `
      ${topbarHTML(questionnaire.title, '<a href="#/">Esci</a>')}
      <main class="container">
        <div class="card">
          <p class="hint" style="margin-top:0;">Allenamento &middot; Domanda ${session.index + 1} di ${total} &middot; nessun risultato viene salvato</p>
          <p class="question-text">${escapeHtml(q.text)}</p>
          ${q.image_url ? `<img class="question-image" src="${q.image_url}" alt="" />` : ""}
          <div id="controlArea">${controlHTML(q, checked)}</div>
          <div id="feedbackArea">${checked ? feedbackHTML(q) : ""}</div>
          <div class="btn-row">
            ${checked ? "" : `<button class="btn" id="checkBtn" ${isAnswered(q) ? "" : "disabled"}>Verifica risposta</button>`}
            ${checked ? `<button class="btn" id="nextBtn">${session.index === total - 1 ? "Vedi risultato" : "Prossima domanda"}</button>` : ""}
          </div>
        </div>
      </main>
    `;

    wireControls(q, checked);

    if (!checked) {
      app.querySelector("#checkBtn").addEventListener("click", () => {
        session.correctness[q.id] = evaluate(q);
        session.checked[q.id] = true;
        renderQuestion();
      });
    } else {
      app.querySelector("#nextBtn").addEventListener("click", () => {
        if (session.index === total - 1) {
          renderResult();
        } else {
          session.index += 1;
          renderQuestion();
        }
      });
    }
  }

  function renderResult() {
    const gradable = session.list.filter((q) => session.correctness[q.id] === true || session.correctness[q.id] === false);
    const correctCount = gradable.filter((q) => session.correctness[q.id] === true).length;
    const openCount = session.list.filter((q) => q.type === "open").length;

    app.innerHTML = `
      ${topbarHTML(questionnaire.title, '<a href="#/">Esci</a>')}
      <main class="container">
        <div class="card center">
          <h2>Allenamento completato!</h2>
          ${
            gradable.length > 0
              ? `<p style="font-size:1.4rem;font-weight:700;font-family:var(--font-display);">${correctCount} / ${gradable.length} corrette</p>`
              : `<p class="hint">Nessuna domanda con risposta corretta impostata da valutare.</p>`
          }
          ${
            openCount > 0
              ? `<p class="hint">${openCount} ${openCount === 1 ? "risposta aperta non viene valutata" : "risposte aperte non vengono valutate"} automaticamente.</p>`
              : ""
          }
          <p class="hint">Nessun risultato e' stato salvato: puoi allenarti quante volte vuoi.</p>
          <div class="btn-row">
            <button class="btn secondary" id="retryBtn">Rifai l'allenamento</button>
            <a class="btn secondary" href="#/">Torna alla home</a>
          </div>
        </div>
      </main>
    `;

    app.querySelector("#retryBtn").addEventListener("click", () => {
      session = newSession();
      renderQuestion();
    });
  }
}
