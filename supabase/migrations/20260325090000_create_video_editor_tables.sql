create table if not exists public.timelines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  config jsonb not null,
  asset_registry jsonb not null default '{"assets": {}}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists timelines_project_id_idx on public.timelines(project_id);
create index if not exists timelines_user_id_idx on public.timelines(user_id);

alter table public.timelines enable row level security;

drop policy if exists "Users can view own timelines" on public.timelines;
create policy "Users can view own timelines"
  on public.timelines
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own timelines" on public.timelines;
create policy "Users can insert own timelines"
  on public.timelines
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own timelines" on public.timelines;
create policy "Users can update own timelines"
  on public.timelines
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own timelines" on public.timelines;
create policy "Users can delete own timelines"
  on public.timelines
  for delete
  using (auth.uid() = user_id);

create table if not exists public.effects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  code text not null,
  category text not null check (category in ('entrance', 'exit', 'continuous')),
  description text,
  is_public boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, slug)
);

create index if not exists effects_user_id_idx on public.effects(user_id);

alter table public.effects enable row level security;

drop policy if exists "Users can view own effects" on public.effects;
create policy "Users can view own effects"
  on public.effects
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own effects" on public.effects;
create policy "Users can insert own effects"
  on public.effects
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own effects" on public.effects;
create policy "Users can update own effects"
  on public.effects
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own effects" on public.effects;
create policy "Users can delete own effects"
  on public.effects
  for delete
  using (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'timelines'
  ) then
    alter publication supabase_realtime add table public.timelines;
  end if;
end
$$;
