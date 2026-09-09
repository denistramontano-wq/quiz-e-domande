-- Modalita' allenamento: quiz con domande casuali e riscontro immediato,
-- senza salvare nessun risultato. Va abilitata dall'admin questionario per
-- questionario (di default spenta) perche' mostra le risposte corrette a
-- chi la usa, cosa che altrimenti e' vietata (vedi 0008_correct_answers.sql).

alter table questionnaires add column training_enabled boolean not null default false;

-- Vista usata SOLO dalla modalita' allenamento: include le risposte corrette,
-- ma solo per i questionari con training_enabled = true. Per tutti gli altri
-- questionari resta impossibile per un utente anonimo leggere is_correct /
-- correct_boolean / correct_answer_text (restano visibili solo tramite
-- public_questions, che le esclude sempre, o alle query autenticate admin).
create view training_questions as
select
  q.id,
  q.questionnaire_id,
  q.order_index,
  q.type,
  q.text,
  q.image_url,
  q.required,
  q.created_at,
  q.correct_boolean,
  q.correct_answer_text,
  coalesce(
    (
      select json_agg(json_build_object(
        'id', o.id,
        'text', o.text,
        'note', o.note,
        'order_index', o.order_index,
        'is_correct', o.is_correct
      ) order by o.order_index)
      from question_options o
      where o.question_id = q.id
    ),
    '[]'::json
  ) as question_options
from questions q
join questionnaires qn on qn.id = q.questionnaire_id
where qn.training_enabled = true;

grant select on training_questions to anon, authenticated;
