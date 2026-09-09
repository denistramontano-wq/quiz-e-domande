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

  const uiState = { renamingSectionId: null, deletingSectionId: null };

  const [{ data: sections }, { data: questionnaires }] = await Promise.all([
    supabase.from("sections").select("*").order("order_index", { ascending: true }),
    supabase.from("questionnaires").select("*").order("created_at", { ascending: false }),
  ]);

  const sectionList = sections || [];
  const questionnaireList = questionnaires || [];

  render();

  function questionnairesIn(sectionId) {
    return questionnaireList.filter((q) => q.section_id === sectionId);
  }

  function sectionOptionsHTML(excludeId, selectedId) {
    return (
      `<option value="" ${!selectedId ? "selected" : ""}>Nessuna sezione</option>` +
      sectionList
        .filter((s) => s.id !== excludeId)
        .map((s) => `<option value="${s.id}" ${s.id === selectedId ? "selected" : ""}>${escapeHtml(s.name)}</option>`)
        .join("")
    );
  }

  function render() {
    const main = app.querySelector("main");
    const uncategorized = questionnairesIn(null);

    main.innerHTML = `
      <div class="card">
        <h2>Nuova sezione</h2>
        <label for="newSectionName">Nome sezione</label>
        <input id="newSectionName" type="text" placeholder="Es. Corsi 2026" />
        <button class="btn" id="createSectionBtn">Crea sezione</button>
      </div>

      <div class="card">
        <h2>Nuovo questionario</h2>
        <label for="title">Titolo</label>
        <input id="title" type="text" placeholder="Es. Corso sicurezza 2026" />
        <label for="newQuestionnaireSection">Sezione</label>
        <select id="newQuestionnaireSection">${sectionOptionsHTML(null, null)}</select>
        <button class="btn" id="createBtn">Crea questionario</button>
      </div>

      ${sectionList.map((s) => sectionCardHTML(s)).join("")}

      ${
        uncategorized.length > 0
          ? `<div class="card">
              <h2 style="color:var(--muted);">Senza sezione</h2>
              ${uncategorized.map(itemHTML).join("")}
            </div>`
          : ""
      }

      ${
        sectionList.length === 0 && uncategorized.length === 0
          ? '<div class="card"><div class="empty-state">Nessun questionario creato.</div></div>'
          : ""
      }
    `;

    wireCreateForms();
    sectionList.forEach((s) => wireSectionCard(s));
    questionnaireList.forEach((q) => wireQuestionnaireItem(q));
  }

  function sectionCardHTML(s) {
    const items = questionnairesIn(s.id);
    return `
      <div class="card" data-section-card="${s.id}">
        <div id="sectionHeader-${s.id}">${sectionHeaderHTML(s, items.length)}</div>
        <div id="sectionBody-${s.id}">
          ${items.length === 0 ? '<div class="empty-state">Nessun questionario in questa sezione.</div>' : items.map(itemHTML).join("")}
        </div>
      </div>
    `;
  }

  function sectionHeaderHTML(s, count) {
    if (uiState.renamingSectionId === s.id) {
      return `
        <label for="renameSectionInput">Nome sezione</label>
        <input type="text" id="renameSectionInput" value="${escapeHtml(s.name)}" />
        <div id="renameSectionErr" class="error" style="display:none"></div>
        <div class="btn-row">
          <button class="btn small secondary" data-action="cancel-rename-section">Annulla</button>
          <button class="btn small" data-action="save-rename-section" data-id="${s.id}">Salva</button>
        </div>
      `;
    }
    if (uiState.deletingSectionId === s.id) {
      if (count === 0) {
        return `<h2 style="margin:0;">${escapeHtml(s.name)}</h2>`;
      }
      return `
        <h2 style="margin:0 0 10px;">${escapeHtml(s.name)}</h2>
        <p class="hint">Questa sezione contiene ${count} questionario${count === 1 ? "" : "i"}. Cosa vuoi fare prima di eliminarla?</p>
        <label style="display:flex;align-items:flex-start;gap:8px;font-weight:500;color:var(--text);">
          <input type="radio" name="deleteChoice-${s.id}" value="move" checked style="width:auto;margin-top:3px;" />
          <span>Sposta i questionari in un'altra sezione</span>
        </label>
        <select id="moveTarget-${s.id}" style="margin-top:8px;">${sectionOptionsHTML(s.id, null)}</select>
        <label style="display:flex;align-items:flex-start;gap:8px;font-weight:500;color:var(--text);margin-top:14px;">
          <input type="radio" name="deleteChoice-${s.id}" value="delete" style="width:auto;margin-top:3px;" />
          <span>Elimina anche ${count === 1 ? "il questionario" : `i ${count} questionari`} di questa sezione (irreversibile, elimina anche le risposte ricevute)</span>
        </label>
        <div class="btn-row">
          <button class="btn small secondary" data-action="cancel-delete-section">Annulla</button>
          <button class="btn small danger" data-action="confirm-delete-section" data-id="${s.id}">Conferma eliminazione</button>
        </div>
      `;
    }
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
        <h2 style="margin:0;">${escapeHtml(s.name)}</h2>
        <div class="btn-row" style="margin:0;">
          <button class="btn small secondary" data-action="rename-section" data-id="${s.id}">Rinomina</button>
          <button class="btn small danger" data-action="delete-section" data-id="${s.id}">Elimina</button>
        </div>
      </div>
    `;
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
          <button class="btn small secondary" data-action="toggle" data-id="${q.id}">${q.is_active ? "Disattiva" : "Attiva"}</button>
          <button class="btn small danger" data-action="delete" data-id="${q.id}">Elimina</button>
        </div>
        <div style="margin-top:10px;">
          <label for="moveQ-${q.id}" style="margin-top:0;font-size:0.75rem;">Sezione</label>
          <select id="moveQ-${q.id}" data-action="move-questionnaire" data-id="${q.id}">${sectionOptionsHTML(null, q.section_id)}</select>
        </div>
      </div>
    `;
  }

  function wireCreateForms() {
    const main = app.querySelector("main");

    main.querySelector("#createSectionBtn").addEventListener("click", async () => {
      const input = main.querySelector("#newSectionName");
      const name = input.value.trim();
      if (!name) return;
      const btn = main.querySelector("#createSectionBtn");
      btn.disabled = true;
      const maxOrder = sectionList.reduce((m, s) => Math.max(m, s.order_index), -1);
      const { data: userData } = await supabase.auth.getUser();
      await supabase
        .from("sections")
        .insert({ name, order_index: maxOrder + 1, created_by: userData.user?.id });
      renderAdminDashboard(app);
    });

    main.querySelector("#createBtn").addEventListener("click", async () => {
      const titleInput = main.querySelector("#title");
      const title = titleInput.value.trim();
      if (!title) return;
      const sectionId = main.querySelector("#newQuestionnaireSection").value || null;
      const createBtn = main.querySelector("#createBtn");
      createBtn.disabled = true;
      const shareCode = generateShareCode();
      const { data: userData } = await supabase.auth.getUser();
      const { data: created, error } = await supabase
        .from("questionnaires")
        .insert({ title, share_code: shareCode, section_id: sectionId, created_by: userData.user?.id })
        .select()
        .single();
      if (!error && created) {
        window.location.hash = `#/admin/questionnaire/${created.id}`;
      } else {
        createBtn.disabled = false;
      }
    });
  }

  function wireSectionCard(s) {
    const header = app.querySelector(`#sectionHeader-${s.id}`);

    const renameBtn = header.querySelector('[data-action="rename-section"]');
    if (renameBtn) {
      renameBtn.addEventListener("click", () => {
        uiState.renamingSectionId = s.id;
        header.innerHTML = sectionHeaderHTML(s, questionnairesIn(s.id).length);
        wireSectionCard(s);
      });
    }

    const cancelRename = header.querySelector('[data-action="cancel-rename-section"]');
    if (cancelRename) {
      cancelRename.addEventListener("click", () => {
        uiState.renamingSectionId = null;
        header.innerHTML = sectionHeaderHTML(s, questionnairesIn(s.id).length);
        wireSectionCard(s);
      });
    }

    const saveRename = header.querySelector('[data-action="save-rename-section"]');
    if (saveRename) {
      saveRename.addEventListener("click", async () => {
        const input = header.querySelector("#renameSectionInput");
        const newName = input.value.trim();
        const err = header.querySelector("#renameSectionErr");
        if (!newName) {
          err.textContent = "Il nome non puo' essere vuoto.";
          err.style.display = "block";
          return;
        }
        const { error } = await supabase.from("sections").update({ name: newName }).eq("id", s.id);
        if (error) {
          err.textContent = "Errore durante il salvataggio.";
          err.style.display = "block";
          return;
        }
        s.name = newName;
        uiState.renamingSectionId = null;
        header.innerHTML = sectionHeaderHTML(s, questionnairesIn(s.id).length);
        wireSectionCard(s);
      });
    }

    const deleteBtn = header.querySelector('[data-action="delete-section"]');
    if (deleteBtn) {
      deleteBtn.addEventListener("click", async () => {
        const count = questionnairesIn(s.id).length;
        if (count === 0) {
          if (!confirm(`Eliminare la sezione "${s.name}"?`)) return;
          await supabase.from("sections").delete().eq("id", s.id);
          renderAdminDashboard(app);
          return;
        }
        uiState.deletingSectionId = s.id;
        header.innerHTML = sectionHeaderHTML(s, count);
        wireSectionCard(s);
      });
    }

    const cancelDelete = header.querySelector('[data-action="cancel-delete-section"]');
    if (cancelDelete) {
      cancelDelete.addEventListener("click", () => {
        uiState.deletingSectionId = null;
        header.innerHTML = sectionHeaderHTML(s, questionnairesIn(s.id).length);
        wireSectionCard(s);
      });
    }

    const confirmDelete = header.querySelector('[data-action="confirm-delete-section"]');
    if (confirmDelete) {
      confirmDelete.addEventListener("click", async () => {
        const choice = header.querySelector(`input[name="deleteChoice-${s.id}"]:checked`)?.value;
        confirmDelete.disabled = true;
        if (choice === "delete") {
          await supabase.from("questionnaires").delete().eq("section_id", s.id);
        } else {
          const target = header.querySelector(`#moveTarget-${s.id}`).value || null;
          await supabase.from("questionnaires").update({ section_id: target }).eq("section_id", s.id);
        }
        await supabase.from("sections").delete().eq("id", s.id);
        renderAdminDashboard(app);
      });
    }
  }

  function wireQuestionnaireItem(q) {
    const row = app.querySelector(`[data-row="${q.id}"]`);
    if (!row) return;

    row.querySelector('[data-action="toggle"]').addEventListener("click", async () => {
      await supabase.from("questionnaires").update({ is_active: !q.is_active }).eq("id", q.id);
      renderAdminDashboard(app);
    });

    row.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      if (
        !confirm(`Eliminare "${q.title}" e tutte le risposte ricevute? L'operazione e' irreversibile.`)
      )
        return;
      await supabase.from("questionnaires").delete().eq("id", q.id);
      renderAdminDashboard(app);
    });

    row.querySelector('[data-action="move-questionnaire"]').addEventListener("change", async (e) => {
      const newSectionId = e.target.value || null;
      await supabase.from("questionnaires").update({ section_id: newSectionId }).eq("id", q.id);
      q.section_id = newSectionId;
      render();
    });
  }
}
