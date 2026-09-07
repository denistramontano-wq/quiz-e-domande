import { supabase, ADMIN_EMAIL } from "../supabaseClient.js";
import { topbarHTML } from "../components/topbar.js";

export function renderAdminLogin(app) {
  app.innerHTML = `
    ${topbarHTML("Area amministratore", '<a href="#/">Home</a>')}
    <main class="container">
      <div class="card">
        <h2>Accesso amministratore</h2>
        <p class="hint">Inserisci la password amministratore per gestire i questionari.</p>
        <label for="password">Password</label>
        <input id="password" type="password" autocomplete="current-password" />
        <div id="err" class="error" style="display:none"></div>
        <button class="btn" id="loginBtn">Accedi</button>
      </div>
    </main>
  `;

  const pwd = app.querySelector("#password");
  const err = app.querySelector("#err");
  const btn = app.querySelector("#loginBtn");

  async function doLogin() {
    const password = pwd.value;
    if (!password) return;
    btn.disabled = true;
    btn.textContent = "Accesso in corso...";
    const { error } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password,
    });
    if (error) {
      err.textContent = "Password errata.";
      err.style.display = "block";
      btn.disabled = false;
      btn.textContent = "Accedi";
      return;
    }
    window.location.hash = "#/admin";
  }

  btn.addEventListener("click", doLogin);
  pwd.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doLogin();
  });
}
