import { createClient } from "@supabase/supabase-js";

// La "anon key" e' pensata per essere pubblica lato client: la sicurezza
// e' garantita dalle policy di Row Level Security definite nel database.
// In sviluppo locale (npm run dev) si puo' puntare a un Supabase locale
// (npx supabase start) creando un file .env.local con VITE_SUPABASE_URL e
// VITE_SUPABASE_ANON_KEY: vedi .env.local.example. Senza quel file l'app usa
// sempre il progetto Supabase reale, sia in sviluppo che in produzione.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://lmeelzqhourwtrqjqrls.supabase.co";
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZWVsenFob3Vyd3RycWpxcmxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NDA0MTQsImV4cCI6MjEwNDMxNjQxNH0.FM0YRMA2qblbjti4C8Pv3sfd0yNTdwB-Pj9m0M3VzHQ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const ADMIN_EMAIL = "denis.tramontano@gmail.com";
