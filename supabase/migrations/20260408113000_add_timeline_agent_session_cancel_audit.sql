alter table public.timeline_agent_sessions
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null,
  add column if not exists cancel_source text,
  add column if not exists cancel_reason text;

comment on column public.timeline_agent_sessions.cancelled_at is 'When the timeline agent session was cancelled.';
comment on column public.timeline_agent_sessions.cancelled_by is 'User who cancelled the timeline agent session when known.';
comment on column public.timeline_agent_sessions.cancel_source is 'Origin of the cancellation request (for example agent_chat_ui, browser, admin).';
comment on column public.timeline_agent_sessions.cancel_reason is 'Human-readable reason for cancellation.';
