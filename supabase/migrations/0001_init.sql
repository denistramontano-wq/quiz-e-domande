-- Schema per l'app "Quiz e Domande"
-- Questionari creati dall'admin, compilati da utenti senza login (nome + matricola a 5 cifre)

create extension if not exists "pgcrypto";

-- ============================================================
-- QUESTIONARI
-- ============================================================
create table questionnaires (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  share_code text not null unique,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- DOMANDE
-- ============================================================
create table questions (
  id uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null references questionnaires(id) on delete cascade,
  order_index int not null default 0,
  type text not null check (type in ('open', 'single_choice', 'multiple_choice', 'true_false', 'photo')),
  text text not null,
  image_url text,
  required boolean not null default true,
  created_at timestamptz not null default now()
);

create index questions_questionnaire_id_idx on questions(questionnaire_id);

-- Opzioni di risposta per single_choice / multiple_choice (con nota facoltativa)
create table question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  text text not null,
  note text,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create index question_options_question_id_idx on question_options(question_id);

-- ============================================================
-- RISPOSTE (una sessione di compilazione = un respondent)
-- ============================================================
create table responses (
  id uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null references questionnaires(id) on delete cascade,
  respondent_name text not null,
  matricola text not null check (matricola ~ '^[0-9]{5}$'),
  submitted_at timestamptz not null default now()
);

create index responses_questionnaire_id_idx on responses(questionnaire_id);

create table answers (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references responses(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  answer_text text,
  photo_url text,
  created_at timestamptz not null default now()
);

create index answers_response_id_idx on answers(response_id);

-- Opzioni selezionate per domande single_choice / multiple_choice
create table answer_options (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references answers(id) on delete cascade,
  option_id uuid not null references question_options(id) on delete cascade
);

create index answer_options_answer_id_idx on answer_options(answer_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table questionnaires enable row level security;
alter table questions enable row level security;
alter table question_options enable row level security;
alter table responses enable row level security;
alter table answers enable row level security;
alter table answer_options enable row level security;

-- Questionari: lettura pubblica solo se attivi, scrittura solo admin autenticato
create policy "public can read active questionnaires"
  on questionnaires for select
  to anon, authenticated
  using (is_active = true or auth.role() = 'authenticated');

create policy "admin can insert questionnaires"
  on questionnaires for insert
  to authenticated
  with check (true);

create policy "admin can update questionnaires"
  on questionnaires for update
  to authenticated
  using (true);

create policy "admin can delete questionnaires"
  on questionnaires for delete
  to authenticated
  using (true);

-- Domande e opzioni: lettura pubblica, scrittura solo admin
create policy "public can read questions"
  on questions for select
  to anon, authenticated
  using (true);

create policy "admin can write questions"
  on questions for all
  to authenticated
  using (true)
  with check (true);

create policy "public can read question_options"
  on question_options for select
  to anon, authenticated
  using (true);

create policy "admin can write question_options"
  on question_options for all
  to authenticated
  using (true)
  with check (true);

-- Risposte: chiunque puo' inserire (compilazione senza login), solo admin puo' leggere
create policy "anyone can submit responses"
  on responses for insert
  to anon, authenticated
  with check (true);

create policy "admin can read responses"
  on responses for select
  to authenticated
  using (true);

create policy "admin can delete responses"
  on responses for delete
  to authenticated
  using (true);

create policy "anyone can submit answers"
  on answers for insert
  to anon, authenticated
  with check (true);

create policy "admin can read answers"
  on answers for select
  to authenticated
  using (true);

create policy "anyone can submit answer_options"
  on answer_options for insert
  to anon, authenticated
  with check (true);

create policy "admin can read answer_options"
  on answer_options for select
  to authenticated
  using (true);
