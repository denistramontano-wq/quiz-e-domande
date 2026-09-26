-- Per le domande Vero/Falso con risposta corretta "Falso", l'admin puo'
-- annotare perche' l'affermazione e' falsa. E' una nota ad uso esclusivo
-- dell'amministratore (editor, dettaglio risposta, chiave delle risposte
-- PDF): non deve MAI comparire a chi compila il questionario o a chi usa
-- la modalita' allenamento, quindi NON viene aggiunta a public_questions
-- ne' a training_questions.

alter table questions add column false_explanation text;
