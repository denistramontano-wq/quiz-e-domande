import { supabase } from "../supabaseClient.js";
import { topbarHTML } from "../components/topbar.js";
import { escapeHtml } from "../utils/html.js";
import { downloadCSV } from "../utils/csv.js";

export async function renderAdminResults(app, questionnaireId) {
  app.innerHTML = `${topbarHTML(
    "Risultati",
    '<a href="#/admin">Indietro</a>'
  )}<main class="container"><div class="spinner">Caricamento...</div></main>`;

  const { data: questionnaire } = await supabase
    .from("questionnaires")
    .select("*")
    .eq("id", questionnaireId)
    .single();

  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .eq("questionnaire_id", questionnaireId)
    .order("order_index", { ascending: true });

  const { data: responses } = await supabase
    .from("responses")
    .select("*, answers(*, answer_options(*, question_options(text)))")
    .eq("questionnaire_id", questionnaireId)
    .order("submitted_at", { ascending: false });

  const list = questions || [];
  const allResponses = responses || [];

  function cellValue(response, question) {
    const answer = response.answers.find((a) => a.question_id === question.id);
    if (!answer) return "";
    if (question.type === "open" || question.type === "true_false") {
      return answer.answer_text || "";
    }
    if (question.type === "photo") {
      return answer.photo_url || "";
    }
    if (question.type === "single_choice" || question.type === "multiple_choice") {
      return answer.answer_options.map((ao) => ao.question_options?.text).filter(Boolean).join(", ");
    }
    if (question.type === "reorder") {
      const ordered = [...answer.answer_options].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      return ordered
        .map((ao) => ao.question_options?.text)
        .filter(Boolean)
        .map((text, idx) => `${idx + 1}. ${text}`)
        .join(", ");
    }
    return "";
  }

  function initials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const chars = parts.slice(0, 2).map((p) => p[0].toUpperCase());
    return chars.join("") || "?";
  }

  function renderList(filtered) {
    const main = app.querySelector("main");
    main.innerHTML = `
      <div class="card">
        <h2>${escapeHtml(questionnaire?.title || "")}</h2>
        <p class="hint">${allResponses.length} risposte ricevute in totale.</p>
        <label for="search">Cerca per nome o matricola</label>
        <input id="search" type="text" placeholder="Es. Rossi oppure 01234" />
        <button class="btn secondary" id="exportBtn">Esporta CSV</button>
      </div>
      <div class="card">
        ${
          filtered.length === 0
            ? '<div class="empty-state">Nessuna risposta trovata.</div>'
            : filtered.map(responseRowHTML).join("")
        }
      </div>
    `;

    main.querySelector("#search").addEventListener("input", (e) => {
      applyFilter(e.target.value);
    });

    main.querySelector("#exportBtn").addEventListener("click", () => {
      const header = ["Nome", "Matricola", "Data", ...list.map((q) => q.text)];
      const rows = [header];
      filtered.forEach((r) => {
        rows.push([
          r.respondent_name,
          r.matricola,
          new Date(r.submitted_at).toLocaleString("it-IT"),
          ...list.map((q) => cellValue(r, q)),
        ]);
      });
      const safeTitle = (questionnaire?.title || "risultati").replace(/[^a-z0-9]+/gi, "_");
      downloadCSV(`${safeTitle}.csv`, rows);
    });
  }

  function responseRowHTML(r) {
    const answered = list.filter((q) => cellValue(r, q)).length;
    return `
      <a class="response-row list-item" href="#/admin/questionnaire/${questionnaireId}/results/${r.id}">
        <div class="response-avatar">${escapeHtml(initials(r.respondent_name))}</div>
        <div class="info">
          <strong>${escapeHtml(r.respondent_name)}</strong>
          <span class="meta">Matricola ${escapeHtml(r.matricola)} &middot; ${new Date(r.submitted_at).toLocaleString("it-IT")} &middot; ${answered}/${list.length} risposte</span>
        </div>
        <span class="response-chevron" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
      </a>
    `;
  }

  function applyFilter(query) {
    const q = query.trim().toLowerCase();
    const filtered = !q
      ? allResponses
      : allResponses.filter(
          (r) => r.respondent_name.toLowerCase().includes(q) || r.matricola.includes(q)
        );
    renderList(filtered);
    const search = app.querySelector("#search");
    search.value = query;
    search.focus();
    search.setSelectionRange(query.length, query.length);
  }

  renderList(allResponses);
}
