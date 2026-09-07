-- Consente all'admin di scegliere se mostrare le domande in ordine casuale
-- a ogni utente durante la compilazione del questionario.
alter table questionnaires
  add column randomize_questions boolean not null default false;
