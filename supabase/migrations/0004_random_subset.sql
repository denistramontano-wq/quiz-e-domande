-- Consente all'admin di mostrare solo un sottoinsieme casuale di 10 domande
-- a ogni utente (tutte le domande se il questionario ne ha 10 o meno).
alter table questionnaires
  add column random_subset_enabled boolean not null default false;
