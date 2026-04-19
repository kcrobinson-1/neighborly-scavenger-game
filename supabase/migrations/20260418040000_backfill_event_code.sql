-- Existing rows are testing/demo data, so use a reproducible base-26 sequence
-- for backfill while future draft creation uses random server-side generation.

do $$
declare
  v_draft_count integer;
begin
  select count(*)
  into v_draft_count
  from public.game_event_drafts;

  if v_draft_count > 17576 then
    raise exception 'event_code_space_exhausted'
      using detail = 'Cannot deterministically backfill more than 17576 game event drafts with 3-letter event codes.';
  end if;
end;
$$;

with ordered_drafts as (
  select
    id,
    row_number() over (order by created_at asc, id asc) - 1 as code_index
  from public.game_event_drafts
)
update public.game_event_drafts as draft
set event_code =
  chr(65 + ((ordered_drafts.code_index / 676)::integer % 26)) ||
  chr(65 + ((ordered_drafts.code_index / 26)::integer % 26)) ||
  chr(65 + (ordered_drafts.code_index::integer % 26))
from ordered_drafts
where draft.id = ordered_drafts.id;

update public.game_events as event
set event_code = draft.event_code
from public.game_event_drafts as draft
where event.id = draft.id;

do $$
begin
  if exists (
    select 1
    from public.game_events
    where event_code is null
  ) then
    raise exception 'event_code_backfill_incomplete'
      using detail = 'Every game_events row must have a matching game_event_drafts row before event_code can become NOT NULL.';
  end if;
end;
$$;

alter table public.game_event_drafts
  alter column event_code set not null;

alter table public.game_events
  alter column event_code set not null;

create unique index game_event_drafts_event_code_key
  on public.game_event_drafts (event_code);

create unique index game_events_event_code_key
  on public.game_events (event_code);

create or replace function public.generate_random_event_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  v_code_index integer;
  v_raw integer;
begin
  loop
    v_raw = (('x' || encode(extensions.gen_random_bytes(2), 'hex'))::bit(16)::integer);

    -- Rejection sampling keeps the 17,576-code space uniform. 52,728 is
    -- exactly three full code spaces below the 16-bit ceiling.
    if v_raw < 52728 then
      v_code_index = v_raw % 17576;

      return
        chr(65 + ((v_code_index / 676)::integer % 26)) ||
        chr(65 + ((v_code_index / 26)::integer % 26)) ||
        chr(65 + (v_code_index % 26));
    end if;
  end loop;
end;
$$;

revoke execute on function public.generate_random_event_code()
from public, anon, authenticated;

grant execute on function public.generate_random_event_code()
to service_role;
