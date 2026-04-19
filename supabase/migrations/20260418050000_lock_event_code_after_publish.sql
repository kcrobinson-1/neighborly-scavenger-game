-- Atomically enforce event-code immutability after first publish, matching the
-- existing slug-lock invariant at the database layer.

create or replace function public.enforce_game_event_draft_event_code_lock()
returns trigger
language plpgsql
as $$
begin
  raise exception 'event_code_locked'
    using detail = 'Event code cannot be changed after the event has been published.';
  return new;
end;
$$;

create trigger game_event_draft_event_code_lock
  before update on public.game_event_drafts
  for each row
  when (
    old.live_version_number is not null
    and new.event_code is distinct from old.event_code
  )
  execute function public.enforce_game_event_draft_event_code_lock();
