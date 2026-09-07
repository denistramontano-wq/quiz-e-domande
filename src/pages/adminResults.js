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
    return "";
  }

  function renderTable(filtered) {
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
            : `<div class="table-scroll"><table class="results-table">
                <thead><tr>
                  <th>Nome</th>
                  <th>Matricola</th>
                  <th>Data</th>
                  ${list.map((q, i) => `<th>D${i + 1}</th>`).join("")}
                </tr></thead>
                <tbody>
                  ${filtered
                    .map(
                      (r) => `
                    <tr>
                      <td>${escapeHtml(r.respondent_name)}</td>
                      <td>${escapeHtml(r.matricola)}</td>
                      <td>${new Date(r.submitted_at).toLocaleString("it-IT")}</td>
                      ${list
                        .map((q) => {
                          const val = cellValue(r, q);
                          if (q.type === "photo" && val) {
                            return `<td><a href="${val}" target="_blank" rel="noopener">Foto</a></td>`;
                          }
                          return `<td>${escapeHtml(val)}</td>`;
                        })
                        .join("")}
                    </tr>`
                    )
                    .join("")}
                </tbody>
              </table></div>`
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

  function applyFilter(query) {
    const q = query.trim().toLowerCase();
    const filtered = !q
      ? allResponses
      : allResponses.filter(
          (r) => r.respondent_name.toLowerCase().includes(q) || r.matricola.includes(q)
        );
    renderTable(filtered);
    const search = app.querySelector("#search");
    search.value = query;
    search.focus();
    search.setSelectionRange(query.length, query.length);
  }

  renderTable(allResponses);
}
