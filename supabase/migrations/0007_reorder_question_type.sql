-- Nuovo tipo di domanda "riordina risposte": l'utente riceve gli elementi
-- in ordine casuale e deve riordinarli. L'ordine scelto viene salvato
-- tramite la nuova colonna answer_options.position.
alter table questions drop constraint questions_type_check;
alter table questions add constraint questions_type_check
  check (type in ('open', 'single_choice', 'multiple_choice', 'true_false', 'photo', 'reorder'));

alter table answer_options add column position int;
