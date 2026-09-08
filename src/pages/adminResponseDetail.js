import { supabase } from "../supabaseClient.js";
import { topbarHTML } from "../components/topbar.js";
import { escapeHtml } from "../utils/html.js";

export async function renderAdminResponseDetail(app, questionnaireId, responseId) {
  app.innerHTML = `${topbarHTML(
    "Risposta",
    `<a href="#/admin/questionnaire/${questionnaireId}/results">Indietro</a>`
  )}<main class="container"><div class="spinner">Caricamento...</div></main>`;

  const [{ data: questionnaire }, { data: questions }, { data: response, error: respError }] = await Promise.all([
    supabase.from("questionnaires").select("*").eq("id", questionnaireId).single(),
    supabase
      .from("questions")
      .select("*")
      .eq("questionnaire_id", questionnaireId)
      .order("order_index", { ascending: true }),
    supabase
      .from("responses")
      .select("*, answers(*, answer_options(*, question_options(text)))")
      .eq("id", responseId)
      .single(),
  ]);

  if (respError || !response) {
    app.querySelector("main").innerHTML = `<div class="card empty-state">Risposta non trovata.</div>`;
    return;
  }

  const list = questions || [];

  function answerFor(question) {
    const answer = response.answers.find((a) => a.question_id === question.id);
    if (!answer) return { text: "", photoUrl: null };
    if (question.type === "open" || question.type === "true_false") {
      return { text: answer.answer_text || "", photoUrl: null };
    }
    if (question.type === "photo") {
      return { text: "", photoUrl: answer.photo_url || null };
    }
    if (question.type === "single_choice" || question.type === "multiple_choice") {
      return {
        text: answer.answer_options.map((ao) => ao.question_options?.text).filter(Boolean).join(", "),
        photoUrl: null,
      };
    }
    if (question.type === "reorder") {
      const ordered = [...answer.answer_options].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      const text = ordered
        .map((ao) => ao.question_options?.text)
        .filter(Boolean)
        .map((t, idx) => `${idx + 1}. ${t}`)
        .join("\n");
      return { text, photoUrl: null };
    }
    return { text: "", photoUrl: null };
  }

  render();

  function render() {
    const main = app.querySelector("main");
    main.innerHTML = `
      <div class="card">
        <div id="identityView"></div>
        <p class="hint" id="submittedAt" style="margin-top:10px;">Inviato il ${new Date(response.submitted_at).toLocaleString("it-IT")}</p>
        <div class="btn-row">
          <button class="btn secondary" id="pdfBtn">Scarica PDF</button>
          <button class="btn danger" id="deleteBtn">Elimina risposta</button>
        </div>
      </div>

      <div class="card">
        <h2>${escapeHtml(questionnaire?.title || "")}</h2>
        ${
          list.length === 0
            ? '<div class="empty-state">Questo questionario non ha domande.</div>'
            : list.map((q, i) => qaBlockHTML(q, i)).join("")
        }
      </div>
    `;

    renderIdentityView();

    main.querySelector("#pdfBtn").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const original = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Genero il PDF...";
      try {
        const { downloadResponsePdf } = await import("../utils/pdf.js");
        await downloadResponsePdf({
          questionnaireTitle: questionnaire?.title || "Questionario",
          respondentName: response.respondent_name,
          matricola: response.matricola,
          submittedAt: response.submitted_at,
          items: list.map((q) => {
            const a = answerFor(q);
            return { questionText: q.text, answerText: a.text, photoUrl: a.photoUrl };
          }),
        });
      } catch (err) {
        console.error(err);
        alert("Errore nella generazione del PDF.");
      } finally {
        btn.disabled = false;
        btn.textContent = original;
      }
    });

    main.querySelector("#deleteBtn").addEventListener("click", async () => {
      if (
        !confirm(
          `Eliminare la risposta di "${response.respondent_name}"? L'operazione e' irreversibile.`
        )
      )
        return;
      await supabase.from("responses").delete().eq("id", response.id);
      window.location.hash = `#/admin/questionnaire/${questionnaireId}/results`;
    });
  }

  function renderIdentityView() {
    const main = app.querySelector("main");
    const container = main.querySelector("#identityView");
    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <div>
          <h2 style="margin:0 0 6px;">${escapeHtml(response.respondent_name)}</h2>
          <span class="badge">Matricola ${escapeHtml(response.matricola)}</span>
        </div>
        <button class="btn small secondary" id="editIdentityBtn">Modifica</button>
      </div>
    `;
    container.querySelector("#editIdentityBtn").addEventListener("click", renderIdentityEdit);
  }

  function renderIdentityEdit() {
    const main = app.querySelector("main");
    const container = main.querySelector("#identityView");
    container.innerHTML = `
      <label for="editName">Nome e cognome</label>
      <input type="text" id="editName" value="${escapeHtml(response.respondent_name)}" />
      <label for="editMatricola">Matricola (5 cifre)</label>
      <input type="tel" id="editMatricola" inputmode="numeric" maxlength="5" value="${escapeHtml(response.matricola)}" />
      <div id="identityErr" class="error" style="display:none"></div>
      <div class="btn-row">
        <button class="btn small secondary" id="cancelIdentity">Annulla</button>
        <button class="btn small" id="saveIdentity">Salva</button>
      </div>
    `;
    container.querySelector("#editMatricola").addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 5);
    });
    container.querySelector("#cancelIdentity").addEventListener("click", renderIdentityView);
    container.querySelector("#saveIdentity").addEventListener("click", async () => {
      const name = container.querySelector("#editName").value.trim();
      const matricola = container.querySelector("#editMatricola").value.trim();
      const err = container.querySelector("#identityErr");
      if (!name) {
        err.textContent = "Il nome non puo' essere vuoto.";
        err.style.display = "block";
        return;
      }
      if (!/^\d{5}$/.test(matricola)) {
        err.textContent = "La matricola deve avere esattamente 5 cifre.";
        err.style.display = "block";
        return;
      }
      const { error } = await supabase
        .from("responses")
        .update({ respondent_name: name, matricola })
        .eq("id", response.id);
      if (error) {
        err.textContent = "Errore durante il salvataggio.";
        err.style.display = "block";
        return;
      }
      response.respondent_name = name;
      response.matricola = matricola;
      renderIdentityView();
    });
  }

  function qaBlockHTML(q, i) {
    const a = answerFor(q);
    let answerHtml;
    if (a.photoUrl) {
      answerHtml = `<img src="${a.photoUrl}" class="photo-preview" alt="Foto allegata alla risposta" />`;
    } else if (a.text) {
      answerHtml = `<div class="qa-answer">${escapeHtml(a.text)}</div>`;
    } else {
      answerHtml = `<div class="qa-answer qa-answer-empty">Nessuna risposta</div>`;
    }
    return `
      <div class="qa-block">
        <div class="question-index">Domanda ${i + 1}</div>
        <div class="qa-question">${escapeHtml(q.text)}</div>
        ${answerHtml}
      </div>
    `;
  }
}
