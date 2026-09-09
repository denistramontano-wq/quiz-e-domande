import "./styles.css";
import { supabase } from "./supabaseClient.js";
import { renderHome } from "./pages/home.js";
import { renderRespond } from "./pages/respond.js";
import { renderTraining } from "./pages/training.js";
import { renderAdminLogin } from "./pages/adminLogin.js";
import { renderAdminDashboard } from "./pages/adminDashboard.js";
import { renderAdminEditor } from "./pages/adminEditor.js";
import { renderAdminResults } from "./pages/adminResults.js";
import { renderAdminResponseDetail } from "./pages/adminResponseDetail.js";

const app = document.getElementById("app");

async function router() {
  const hash = window.location.hash.slice(1) || "/";
  const parts = hash.split("/").filter(Boolean);

  if (parts.length === 0) {
    return renderHome(app);
  }

  if (parts[0] === "q" && parts[1]) {
    return renderRespond(app, parts[1]);
  }

  if (parts[0] === "allena" && parts[1]) {
    return renderTraining(app, parts[1]);
  }

  if (parts[0] === "admin") {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return renderAdminLogin(app);
    }
    if (parts.length === 1) {
      return renderAdminDashboard(app);
    }
    if (parts[1] === "questionnaire" && parts[2]) {
      if (parts[3] === "results") {
        if (parts[4]) {
          return renderAdminResponseDetail(app, parts[2], parts[4]);
        }
        return renderAdminResults(app, parts[2]);
      }
      return renderAdminEditor(app, parts[2]);
    }
    return renderAdminDashboard(app);
  }

  return renderHome(app);
}

window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", router);

supabase.auth.onAuthStateChange(() => {
  router();
});
