import { supabase } from "../supabaseClient.js";
import { topbarHTML } from "../components/topbar.js";
import { generateShareCode } from "../utils/shareCode.js";
import { escapeHtml } from "../utils/html.js";

export async function renderAdminDashboard(app) {
  app.innerHTML = `${topbarHTML(
    "Area amministratore",
    '<button class="link" id="logout">Esci</button>'
  )}<main class="container"><div class="spinner">Caricamento...</div></main>`;

  app.querySelector("#logout").addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.hash = "#/";
  });

  const { data: questionnaires } = await supabase
    .from("questionnaires")
    .select("*")
    .order("created_at", { ascending: false });

  renderList(questionnaires || []);

  function renderList(list) {
    const main = app.querySelector("main");
    main.innerHTML = `
      <div class="card">
        <h2>Nuovo questionario</h2>
        <label for="title">Titolo</label>
        <input id="title" type="text" placeholder="Es. Corso sicurezza 2026" />
        <button class="btn" id="createBtn">Crea questionario</button>
      </div>
      <div class="card">
        <h2>I tuoi questionari</h2>
        ${
          list.length === 0
            ? '<div class="empty-state">Nessun questionario creato.</div>'
            : list.map(itemHTML).join("")
        }
      </div>
    `;

    main.querySelector("#createBtn").addEventListener("click", async () => {
      const titleInput = main.querySelector("#title");
      const title = titleInput.value.trim();
      if (!title) return;
      const createBtn = main.querySelector("#createBtn");
      createBtn.disabled = true;
      const shareCode = generateShareCode();
      const { data: userData } = await supabase.auth.getUser();
      const { data: created, error } = await supabase
        .from("questionnaires")
        .insert({ title, share_code: shareCode, created_by: userData.user?.id })
        .select()
        .single();
      if (!error && created) {
        window.location.hash = `#/admin/questionnaire/${created.id}`;
      } else {
        createBtn.disabled = false;
      }
    });

    list.forEach((q) => {
      const row = main.querySelector(`[data-row="${q.id}"]`);
      row.querySelector('[data-action="toggle"]').addEventListener("click", async () => {
        await supabase.from("questionnaires").update({ is_active: !q.is_active }).eq("id", q.id);
        renderAdminDashboard(app);
      });
      row.querySelector('[data-action="delete"]').addEventListener("click", async () => {
        if (
          !confirm(
            `Eliminare "${q.title}" e tutte le risposte ricevute? L'operazione e' irreversibile.`
          )
        )
          return;
        await supabase.from("questionnaires").delete().eq("id", q.id);
        renderAdminDashboard(app);
      });
    });
  }

  function itemHTML(q) {
    return `
      <div class="list-item" data-row="${q.id}" style="flex-direction:column;align-items:stretch;">
        <div class="info">
          <strong>${escapeHtml(q.title)}</strong>
          <span class="meta">Codice: <b>${q.share_code}</b> &middot;
            <span class="badge ${q.is_active ? "" : "inactive"}">${q.is_active ? "Attivo" : "Non attivo"}</span>
          </span>
        </div>
        <div class="btn-row" style="margin-top:10px;flex-wrap:wrap;">
          <a class="btn small secondary" href="#/admin/questionnaire/${q.id}">Domande</a>
          <a class="btn small secondary" href="#/admin/questionnaire/${q.id}/results">Risultati</a>
          <button class="btn small secondary" data-action="toggle">${q.is_active ? "Disattiva" : "Attiva"}</button>
          <button class="btn small danger" data-action="delete">Elimina</button>
        </div>
      </div>
    `;
  }
}
