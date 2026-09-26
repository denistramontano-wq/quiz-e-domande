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

Di default questo comando fa partire l'app sul tuo computer ma la collega comunque al Supabase reale online (stesse credenziali di produzione, vedi sotto). Per testare senza toccare i dati veri, vedi la sezione successiva.

## Test in locale con un database separato

Per provare modifiche (anche solo compilare questionari di prova) senza che finiscano mescolate ai dati veri dei corsi, puoi far girare un Supabase completo in locale con Docker:

1. Installa [Docker Desktop](https://www.docker.com/products/docker-desktop/) (deve restare avviato) e Node.js.
2. Nella cartella del progetto avvia lo stack locale (la prima volta scarica alcune immagini Docker, puo' richiedere qualche minuto):
   ```bash
   npx supabase start
   ```
   Al termine stampa un blocco con `API URL`, `anon key` e il link a `Studio` (l'interfaccia grafica del database, di solito `http://127.0.0.1:54323`).
3. Copia `.env.local.example` in `.env.local` e incolla `API URL` e `anon key` stampati sopra.
4. Applica lo schema (tabelle, viste, policy) al database locale appena creato:
   ```bash
   npx supabase db reset
   ```
5. Crea l'utente amministratore locale da Studio (`http://127.0.0.1:54323` &rarr; Authentication &rarr; Add user &rarr; "Create new user"): stessa email usata in produzione, password a tua scelta, spuntando "Auto Confirm User". E' un utente separato da quello reale, vale solo per questa copia locale.
6. Avvia l'app: `npm run dev` e apri l'indirizzo che stampa (di solito `http://localhost:5173`). Ora l'app usa il database locale: puoi creare questionari, compilarli e cancellare tutto senza rischi.

Per tornare al Supabase reale basta rinominare/cancellare `.env.local`. Per fermare lo stack locale: `npx supabase stop` (aggiungi `--no-backup` se vuoi anche svuotare i dati locali salvati).

## Build di produzione

```bash
npm run build
```

I file pronti per il deploy si trovano in `dist/`.

## Configurazione Supabase

Le credenziali del progetto Supabase (URL e chiave pubblica "anon") sono in `src/supabaseClient.js`, e sono quelle usate di default sia in sviluppo che in produzione. La anon key e' pensata per essere pubblica: la sicurezza dei dati e' garantita dalle policy di Row Level Security definite nelle migration in `supabase/migrations/`. Un file `.env.local` (vedi sezione "Test in locale con un database separato") le sovrascrive solo per lo sviluppo sul proprio computer, senza toccare la build di produzione.

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
