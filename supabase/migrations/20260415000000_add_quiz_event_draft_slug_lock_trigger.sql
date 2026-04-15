-- Atomically enforce slug immutability after first publish.
--
-- The application layer also checks this before upserting, but that check is a
-- separate SELECT and is not atomic. This trigger fires under the row's write
-- lock during the UPDATE, so no concurrent publish can slip between the check
-- and the write.

create or replace function enforce_quiz_event_draft_slug_lock()
returns trigger
language plpgsql
as $$
begin
  raise exception 'slug_locked'
    using detail = 'Slug cannot be changed after the event has been published.';
  return new;
end;
$$;

create trigger quiz_event_draft_slug_lock
  before update on quiz_event_drafts
  for each row
  when (
    old.live_version_number is not null
    and new.slug is distinct from old.slug
  )
  execute function enforce_quiz_event_draft_slug_lock();
