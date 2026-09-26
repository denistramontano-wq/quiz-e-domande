-- Risposte esatte: l'admin puo' segnare la risposta corretta per ogni tipo
-- di domanda. Queste colonne non devono MAI essere leggibili da chi
-- compila il questionario, quindi rimuoviamo la lettura pubblica diretta
-- sulle tabelle e la sostituiamo con una vista sicura che le esclude.

alter table question_options add column is_correct boolean not null default false;
alter table questions add column correct_boolean boolean;
alter table questions add column correct_answer_text text;

drop policy "public can read questions" on questions;
drop policy "public can read question_options" on question_options;

-- Vista usata dai rispondenti (anon) per leggere domande e opzioni senza
-- mai esporre is_correct / correct_boolean / correct_answer_text.
-- E' intenzionalmente "security definer" (comportamento di default per le
-- view di Postgres): legge le tabelle sottostanti con i permessi di chi
-- l'ha creata, cosa necessaria dato che agli anonimi e' stata tolta la
-- lettura diretta sulle tabelle originali.
create view public_questions as
select
  q.id,
  q.questionnaire_id,
  q.order_index,
  q.type,
  q.text,
  q.image_url,
  q.required,
  q.created_at,
  coalesce(
    (
      select json_agg(json_build_object(
        'id', o.id,
        'text', o.text,
        'note', o.note,
        'order_index', o.order_index
      ) order by o.order_index)
      from question_options o
      where o.question_id = q.id
    ),
    '[]'::json
  ) as question_options
from questions q;

grant select on public_questions to anon, authenticated;
