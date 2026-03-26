create table if not exists public.timeline_agent_sessions (
  id uuid primary key default gen_random_uuid(),
  timeline_id uuid not null references public.timelines(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'waiting_user' check (status in ('waiting_user', 'processing', 'continue', 'done', 'cancelled', 'error')),
  turns jsonb not null default '[]'::jsonb,
  model text not null default 'groq',
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists timeline_agent_sessions_timeline_id_status_idx
  on public.timeline_agent_sessions (timeline_id, status);

alter table public.timeline_agent_sessions enable row level security;

drop policy if exists "Users can view own timeline agent sessions" on public.timeline_agent_sessions;
create policy "Users can view own timeline agent sessions"
  on public.timeline_agent_sessions
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own timeline agent sessions" on public.timeline_agent_sessions;
create policy "Users can insert own timeline agent sessions"
  on public.timeline_agent_sessions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own timeline agent sessions" on public.timeline_agent_sessions;
create policy "Users can update own timeline agent sessions"
  on public.timeline_agent_sessions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'timeline_agent_sessions'
  ) then
    alter publication supabase_realtime add table public.timeline_agent_sessions;
  end if;
end
$$;
