import { topbarHTML } from "../components/topbar.js";

export function renderHome(app) {
  app.innerHTML = `
    ${topbarHTML("Quiz e Domande")}
    <main class="container">
      <div class="card">
        <h2>Compila un questionario</h2>
        <p class="hint">Inserisci il codice che ti e' stato fornito, oppure apri direttamente il link ricevuto.</p>
        <label for="code">Codice questionario</label>
        <input id="code" type="text" placeholder="Es. AB12CD" autocomplete="off" autocapitalize="characters" maxlength="8" />
        <div id="err" class="error" style="display:none"></div>
        <button class="btn" id="go">Vai al questionario</button>
      </div>
      <p class="center"><a href="#/admin">Area amministratore</a></p>
    </main>
  `;

  const input = app.querySelector("#code");
  const err = app.querySelector("#err");
  const go = () => {
    const code = input.value.trim().toUpperCase();
    if (!code) {
      err.textContent = "Inserisci un codice valido.";
      err.style.display = "block";
      return;
    }
    window.location.hash = `#/q/${code}`;
  };

  app.querySelector("#go").addEventListener("click", go);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") go();
  });
  input.addEventListener("input", () => {
    input.value = input.value.toUpperCase();
  });
}
