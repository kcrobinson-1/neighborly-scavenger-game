-- Add the server-owned event-code columns as nullable first so existing rows
-- can be backfilled deterministically before NOT NULL is enforced.

alter table public.game_event_drafts
  add column event_code text;

alter table public.game_events
  add column event_code text;

alter table public.game_event_drafts
  add constraint game_event_drafts_event_code_format
  check (event_code is null or event_code ~ '^[A-Z]{3}$');

alter table public.game_events
  add constraint game_events_event_code_format
  check (event_code is null or event_code ~ '^[A-Z]{3}$');
