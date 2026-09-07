import { createClient } from "@supabase/supabase-js";

// La "anon key" e' pensata per essere pubblica lato client: la sicurezza
// e' garantita dalle policy di Row Level Security definite nel database.
const SUPABASE_URL = "https://lmeelzqhourwtrqjqrls.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZWVsenFob3Vyd3RycWpxcmxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NDA0MTQsImV4cCI6MjEwNDMxNjQxNH0.FM0YRMA2qblbjti4C8Pv3sfd0yNTdwB-Pj9m0M3VzHQ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const ADMIN_EMAIL = "denis.tramontano@gmail.com";
