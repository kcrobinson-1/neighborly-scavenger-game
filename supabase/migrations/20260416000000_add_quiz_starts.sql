create table public.quiz_starts (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  client_session_id text not null,
  issued_at timestamptz not null default now(),
  unique (event_id, client_session_id)
);

alter table public.quiz_starts enable row level security;
-- No public read policy: analytics-only table, accessed via service role only.
