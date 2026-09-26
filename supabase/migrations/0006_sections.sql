-- Sezioni per organizzare i questionari.
create table sections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  order_index int not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table questionnaires add column section_id uuid references sections(id) on delete set null;
create index questionnaires_section_id_idx on questionnaires(section_id);

alter table sections enable row level security;

create policy "admin can read sections"
  on sections for select
  to authenticated
  using (true);

create policy "admin can write sections"
  on sections for all
  to authenticated
  using (true)
  with check (true);
