-- Bucket pubblico per le foto (immagini nelle domande + foto caricate come risposta)
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "public can read photos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'photos');

create policy "anyone can upload photos"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'photos');
