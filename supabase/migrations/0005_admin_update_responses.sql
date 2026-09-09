-- Consente all'admin di correggere nome/matricola di una risposta gia' inviata.
create policy "admin can update responses"
  on responses for update
  to authenticated
  using (true)
  with check (true);
