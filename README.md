# Quiz e Domande

Web app / PWA mobile-friendly per creare questionari e farli compilare senza login.

## Come funziona

- **Chi risponde**: apre il link del questionario (o inserisce il codice nella home), inserisce nome e numero di matricola (5 cifre), poi compila le domande. Nessun account richiesto.
- **Admin**: accede da `/#/admin` con una password, crea questionari, aggiunge domande di 5 tipi (risposta aperta, risposta chiusa, risposte multiple, vero/falso, carica foto), consulta le risposte ricevute ed esporta i risultati in CSV.

## Stack

- Frontend: Vite + JavaScript vanilla, PWA installabile (manifest + service worker via `vite-plugin-pwa`)
- Backend: [Supabase](https://supabase.com) (Postgres + Auth + Storage), con Row Level Security
- Nessun server da mantenere: l'app e' completamente statica, deploy su qualsiasi hosting statico (Netlify, Vercel, GitHub Pages, ecc.)

## Sviluppo locale

```bash
npm install
npm run dev
```

## Build di produzione

```bash
npm run build
```

I file pronti per il deploy si trovano in `dist/`.

## Configurazione Supabase

Le credenziali del progetto Supabase (URL e chiave pubblica "anon") sono in `src/supabaseClient.js`. La anon key e' pensata per essere pubblica: la sicurezza dei dati e' garantita dalle policy di Row Level Security definite nelle migration in `supabase/migrations/`.

Lo schema del database (tabelle, policy, bucket per le foto) e' gia' stato applicato al progetto Supabase collegato a questa app. Le migration in `supabase/migrations/` servono da riferimento/versionamento dello schema.

## Struttura del progetto

```
src/
  pages/          pagine dell'app (home, compilazione, login/admin, editor domande, risultati)
  components/      componenti UI condivisi (es. topbar)
  utils/           helper (upload foto, export CSV, codice condivisione, escape HTML)
  supabaseClient.js  client Supabase condiviso
  main.js          router SPA basato su hash
  styles.css       stile globale mobile-first
supabase/migrations/  schema del database e policy RLS
scripts/generate-icons.mjs  script per generare le icone PWA
```
