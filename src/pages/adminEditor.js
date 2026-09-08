import QRCode from "qrcode";
import { supabase } from "../supabaseClient.js";
import { topbarHTML } from "../components/topbar.js";
import { escapeHtml } from "../utils/html.js";
import { uploadPhoto } from "../utils/uploadPhoto.js";

const TYPE_LABELS = {
  open: "Risposta aperta",
  single_choice: "Risposta chiusa (singola)",
  multiple_choice: "Risposte multiple",
  true_false: "Vero / Falso",
  photo: "Carica foto",
};

function blankForm() {
  return {
    editingId: null,
    type: "open",
    text: "",
    required: true,
    imageUrl: null,
    options: [
      { text: "", note: "" },
      { text: "", note: "" },
    ],
  };
}

export async function renderAdminEditor(app, questionnaireId) {
  let form = blankForm();

  app.innerHTML = `${topbarHTML(
    "Gestione domande",
    '<a href="#/admin">Indietro</a>'
  )}<main class="container"><div class="spinner">Caricamento...</div></main>`;

  const { data: questionnaire, error: qErr } = await supabase
    .from("questionnaires")
    .select("*")
    .eq("id", questionnaireId)
    .single();

  if (qErr || !questionnaire) {
    app.querySelector("main").innerHTML = `<div class="card empty-state">Questionario non trovato.</div>`;
    return;
  }

  await load();

  async function load() {
    const { data: questions } = await supabase
      .from("questions")
      .select("*, question_options(*)")
      .eq("questionnaire_id", questionnaireId)
      .order("order_index", { ascending: true });

    (questions || []).forEach((q) => q.question_options.sort((a, b) => a.order_index - b.order_index));
    render(questions || []);
  }

  function render(questions) {
    const shareUrl = `${window.location.origin}${window.location.pathname}#/q/${questionnaire.share_code}`;

    const main = app.querySelector("main");
    main.innerHTML = `
      <div class="card">
        <div id="titleView"></div>
        <p class="hint">Condividi questo link con chi deve compilare il questionario:</p>
        <div class="share-box" id="shareUrl">${shareUrl}</div>
        <button class="btn secondary small" id="copyBtn" style="margin-top:10px;">Copia link</button>

        <div class="center" style="margin-top:18px;">
          <img id="qrImg" alt="QR code del questionario" style="width:180px;height:180px;border-radius:16px;border:1px solid var(--border);" />
          <div>
            <a class="btn secondary small" id="downloadQr" style="margin-top:10px;" download="qr-${questionnaire.share_code}.png">Scarica QR code</a>
          </div>
        </div>

        <label style="display:flex;align-items:center;gap:8px;margin-top:18px;">
          <input type="checkbox" id="randomize" ${questionnaire.randomize_questions ? "checked" : ""} style="width:auto;" />
          Mostra le domande in ordine casuale a ogni utente
        </label>

        <label style="display:flex;align-items:center;gap:8px;margin-top:10px;">
          <input type="checkbox" id="subsetEnabled" ${questionnaire.random_subset_enabled ? "checked" : ""} style="width:auto;" />
          Estrai solo 10 domande casuali per ogni utente (se il questionario ne ha di piu')
        </label>

        <button class="btn secondary" id="printBlankBtn" style="margin-top:18px;">Stampa questionario vuoto (PDF)</button>
      </div>

      <div class="card">
        <h2>${form.editingId ? "Modifica domanda" : "Aggiungi domanda"}</h2>
        <label>Tipo di domanda</label>
        <div class="type-picker" id="typePicker">
          ${Object.entries(TYPE_LABELS)
            .map(
              ([key, label]) =>
                `<button type="button" data-type="${key}" class="${form.type === key ? "selected" : ""}">${label}</button>`
            )
            .join("")}
        </div>

        <label for="qtext">Testo della domanda</label>
        <textarea id="qtext" placeholder="Scrivi la domanda...">${escapeHtml(form.text)}</textarea>

        <label for="qimage">Immagine allegata alla domanda (facoltativa)</label>
        <input type="file" id="qimage" accept="image/*" />
        <div id="imgStatus" class="hint"></div>
        ${form.imageUrl ? `<img src="${form.imageUrl}" class="photo-preview" id="imgPreview" />` : `<img class="photo-preview" id="imgPreview" style="display:none" />`}

        <label style="display:flex;align-items:center;gap:8px;margin-top:14px;">
          <input type="checkbox" id="required" ${form.required ? "checked" : ""} style="width:auto;" />
          Risposta obbligatoria
        </label>

        <div id="optionsSection"></div>

        <div id="formErr" class="error" style="display:none"></div>
        <div class="btn-row">
          ${form.editingId ? '<button class="btn secondary" id="cancelEdit">Annulla</button>' : ""}
          <button class="btn" id="saveBtn">${form.editingId ? "Salva modifiche" : "Aggiungi domanda"}</button>
        </div>
      </div>

      <div class="card">
        <h2>Domande (${questions.length})</h2>
        ${
          questions.length === 0
            ? '<div class="empty-state">Nessuna domanda ancora. Aggiungine una qui sopra.</div>'
            : questions.map((q, i) => questionItemHTML(q, i, questions.length)).join("")
        }
      </div>
    `;

    renderTitleView();

    main.querySelector("#copyBtn").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(shareUrl);
        main.querySelector("#copyBtn").textContent = "Copiato!";
        setTimeout(() => (main.querySelector("#copyBtn").textContent = "Copia link"), 1500);
      } catch {
        /* clipboard non disponibile, l'utente puo' copiare manualmente */
      }
    });

    QRCode.toDataURL(shareUrl, {
      width: 360,
      margin: 1,
      color: { dark: "#1f1b2e", light: "#ffffff" },
    }).then((dataUrl) => {
      main.querySelector("#qrImg").src = dataUrl;
      main.querySelector("#downloadQr").href = dataUrl;
    });

    main.querySelector("#randomize").addEventListener("change", async (e) => {
      questionnaire.randomize_questions = e.target.checked;
      await supabase
        .from("questionnaires")
        .update({ randomize_questions: e.target.checked })
        .eq("id", questionnaire.id);
    });

    main.querySelector("#subsetEnabled").addEventListener("change", async (e) => {
      questionnaire.random_subset_enabled = e.target.checked;
      await supabase
        .from("questionnaires")
        .update({ random_subset_enabled: e.target.checked })
        .eq("id", questionnaire.id);
    });

    main.querySelector("#printBlankBtn").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const original = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Genero il PDF...";
      try {
        const { downloadBlankQuestionnairePdf } = await import("../utils/pdf.js");
        await downloadBlankQuestionnairePdf({
          title: questionnaire.title,
          description: questionnaire.description,
          questions,
        });
      } catch (err) {
        console.error(err);
        alert("Errore nella generazione del PDF.");
      } finally {
        btn.disabled = false;
        btn.textContent = original;
      }
    });

    renderOptionsSection();
    wireForm(questions);
    wireQuestionList(questions);
  }

  function renderTitleView() {
    const main = app.querySelector("main");
    const container = main.querySelector("#titleView");
    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
        <h2 style="margin:0;">${escapeHtml(questionnaire.title)}</h2>
        <button class="btn small secondary" id="editTitleBtn">Rinomina</button>
      </div>
    `;
    main.querySelector("#editTitleBtn").addEventListener("click", renderTitleEdit);
  }

  function renderTitleEdit() {
    const main = app.querySelector("main");
    const container = main.querySelector("#titleView");
    container.innerHTML = `
      <label for="titleInput">Titolo del questionario</label>
      <input type="text" id="titleInput" value="${escapeHtml(questionnaire.title)}" />
      <div id="titleErr" class="error" style="display:none"></div>
      <div class="btn-row">
        <button class="btn small secondary" id="cancelTitle">Annulla</button>
        <button class="btn small" id="saveTitle">Salva</button>
      </div>
    `;
    const input = container.querySelector("#titleInput");
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);

    container.querySelector("#cancelTitle").addEventListener("click", renderTitleView);
    container.querySelector("#saveTitle").addEventListener("click", async () => {
      const newTitle = input.value.trim();
      const err = container.querySelector("#titleErr");
      if (!newTitle) {
        err.textContent = "Il titolo non puo' essere vuoto.";
        err.style.display = "block";
        return;
      }
      const { error } = await supabase
        .from("questionnaires")
        .update({ title: newTitle })
        .eq("id", questionnaire.id);
      if (error) {
        err.textContent = "Errore durante il salvataggio.";
        err.style.display = "block";
        return;
      }
      questionnaire.title = newTitle;
      renderTitleView();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") container.querySelector("#saveTitle").click();
    });
  }

  function renderOptionsSection() {
    const section = document.getElementById("optionsSection");
    if (!["single_choice", "multiple_choice"].includes(form.type)) {
      section.innerHTML = "";
      return;
    }
    section.innerHTML = `
      <label>Opzioni di risposta</label>
      <div id="optionsList">
        ${form.options
          .map(
            (o, idx) => `
          <div class="card" style="padding:10px;margin-bottom:8px;" data-opt-idx="${idx}">
            <input type="text" placeholder="Testo opzione" class="opt-text" value="${escapeHtml(o.text)}" />
            <input type="text" placeholder="Nota (facoltativa)" class="opt-note" value="${escapeHtml(o.note)}" style="margin-top:8px;" />
            <button type="button" class="icon-btn danger" data-remove-opt="${idx}" style="margin-top:4px;">Rimuovi opzione</button>
          </div>`
          )
          .join("")}
      </div>
      <button type="button" class="btn secondary small" id="addOptBtn">+ Aggiungi opzione</button>
    `;

    section.querySelectorAll(".opt-text").forEach((el, idx) => {
      el.addEventListener("input", () => (form.options[idx].text = el.value));
    });
    section.querySelectorAll(".opt-note").forEach((el, idx) => {
      el.addEventListener("input", () => (form.options[idx].note = el.value));
    });
    section.querySelectorAll("[data-remove-opt]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.removeOpt);
        form.options.splice(idx, 1);
        renderOptionsSection();
      });
    });
    section.querySelector("#addOptBtn").addEventListener("click", () => {
      form.options.push({ text: "", note: "" });
      renderOptionsSection();
    });
  }

  function wireForm(questions) {
    const main = app.querySelector("main");

    main.querySelectorAll("#typePicker button").forEach((btn) => {
      btn.addEventListener("click", () => {
        form.type = btn.dataset.type;
        render(questions);
      });
    });

    main.querySelector("#qtext").addEventListener("input", (e) => {
      form.text = e.target.value;
    });

    main.querySelector("#required").addEventListener("change", (e) => {
      form.required = e.target.checked;
    });

    main.querySelector("#qimage").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const status = main.querySelector("#imgStatus");
      status.textContent = "Caricamento immagine...";
      try {
        const url = await uploadPhoto(file, `questions/${questionnaireId}`);
        form.imageUrl = url;
        status.textContent = "Immagine caricata.";
        const preview = main.querySelector("#imgPreview");
        preview.src = url;
        preview.style.display = "block";
      } catch (err) {
        status.textContent = "Errore nel caricamento dell'immagine.";
        console.error(err);
      }
    });

    if (form.editingId) {
      main.querySelector("#cancelEdit").addEventListener("click", () => {
        form = blankForm();
        render(questions);
      });
    }

    main.querySelector("#saveBtn").addEventListener("click", () => saveQuestion(questions));
  }

  async function saveQuestion(questions) {
    const main = app.querySelector("main");
    const formErr = main.querySelector("#formErr");
    formErr.style.display = "none";

    const text = form.text.trim();
    if (!text) {
      formErr.textContent = "Inserisci il testo della domanda.";
      formErr.style.display = "block";
      return;
    }

    let cleanOptions = [];
    if (["single_choice", "multiple_choice"].includes(form.type)) {
      cleanOptions = form.options.map((o) => ({ text: o.text.trim(), note: o.note.trim() })).filter((o) => o.text);
      if (cleanOptions.length < 2) {
        formErr.textContent = "Aggiungi almeno due opzioni di risposta.";
        formErr.style.display = "block";
        return;
      }
    }

    const saveBtn = main.querySelector("#saveBtn");
    saveBtn.disabled = true;

    try {
      let questionId = form.editingId;
      if (questionId) {
        await supabase
          .from("questions")
          .update({
            type: form.type,
            text,
            image_url: form.imageUrl,
            required: form.required,
          })
          .eq("id", questionId);
        await supabase.from("question_options").delete().eq("question_id", questionId);
      } else {
        const maxOrder = questions.reduce((m, q) => Math.max(m, q.order_index), -1);
        const { data: created, error } = await supabase
          .from("questions")
          .insert({
            questionnaire_id: questionnaireId,
            type: form.type,
            text,
            image_url: form.imageUrl,
            required: form.required,
            order_index: maxOrder + 1,
          })
          .select()
          .single();
        if (error) throw error;
        questionId = created.id;
      }

      if (cleanOptions.length > 0) {
        const rows = cleanOptions.map((o, idx) => ({
          question_id: questionId,
          text: o.text,
          note: o.note || null,
          order_index: idx,
        }));
        await supabase.from("question_options").insert(rows);
      }

      form = blankForm();
      await load();
    } catch (err) {
      formErr.textContent = "Errore durante il salvataggio. Riprova.";
      formErr.style.display = "block";
      saveBtn.disabled = false;
      console.error(err);
    }
  }

  function questionItemHTML(q, i, total) {
    const optionsPreview =
      q.question_options && q.question_options.length > 0
        ? `<ul style="margin:8px 0 0;padding-left:18px;">${q.question_options
            .map((o) => `<li>${escapeHtml(o.text)}${o.note ? ` <span class="hint">(${escapeHtml(o.note)})</span>` : ""}</li>`)
            .join("")}</ul>`
        : "";
    const img = q.image_url ? `<img src="${q.image_url}" class="question-image" style="max-height:120px;" />` : "";

    return `
      <div class="list-item" style="flex-direction:column;align-items:stretch;" data-question="${q.id}">
        <div class="info">
          <span class="badge">${TYPE_LABELS[q.type] || q.type}</span>
          <strong style="margin-top:6px;">${i + 1}. ${escapeHtml(q.text)}</strong>
          ${img}
          ${optionsPreview}
        </div>
        <div class="btn-row" style="margin-top:10px;flex-wrap:wrap;">
          <button class="btn small secondary" data-action="up" ${i === 0 ? "disabled" : ""}>&uarr; Su</button>
          <button class="btn small secondary" data-action="down" ${i === total - 1 ? "disabled" : ""}>&darr; Giu'</button>
          <button class="btn small secondary" data-action="edit">Modifica</button>
          <button class="btn small danger" data-action="delete">Elimina</button>
        </div>
      </div>
    `;
  }

  function wireQuestionList(questions) {
    questions.forEach((q, i) => {
      const row = app.querySelector(`[data-question="${q.id}"]`);
      row.querySelector('[data-action="edit"]').addEventListener("click", () => {
        form = {
          editingId: q.id,
          type: q.type,
          text: q.text,
          required: q.required,
          imageUrl: q.image_url,
          options:
            q.question_options.length > 0
              ? q.question_options.map((o) => ({ text: o.text, note: o.note || "" }))
              : [
                  { text: "", note: "" },
                  { text: "", note: "" },
                ],
        };
        render(questions);
        app.querySelector("main .card:nth-child(2)").scrollIntoView({ behavior: "smooth" });
      });

      row.querySelector('[data-action="delete"]').addEventListener("click", async () => {
        if (!confirm("Eliminare questa domanda? Verranno eliminate anche le eventuali risposte gia' ricevute per questa domanda.")) return;
        await supabase.from("questions").delete().eq("id", q.id);
        await load();
      });

      const upBtn = row.querySelector('[data-action="up"]');
      const downBtn = row.querySelector('[data-action="down"]');
      if (upBtn && !upBtn.disabled) {
        upBtn.addEventListener("click", () => swapOrder(questions, i, i - 1));
      }
      if (downBtn && !downBtn.disabled) {
        downBtn.addEventListener("click", () => swapOrder(questions, i, i + 1));
      }
    });
  }

  async function swapOrder(questions, i, j) {
    const a = questions[i];
    const b = questions[j];
    await supabase.from("questions").update({ order_index: b.order_index }).eq("id", a.id);
    await supabase.from("questions").update({ order_index: a.order_index }).eq("id", b.id);
    await load();
  }
}
