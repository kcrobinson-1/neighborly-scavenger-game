-- Private authoring draft/version schema plus one-time backfill from the
-- already-published quiz projection so publish history starts at version 1.
create table if not exists public.quiz_event_drafts (
  id text primary key,
  slug text not null unique,
  name text not null,
  schema_version smallint not null default 1,
  content jsonb not null,
  live_version_number integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_saved_by uuid,
  constraint quiz_event_drafts_schema_version_positive
    check (schema_version > 0),
  constraint quiz_event_drafts_live_version_number_positive
    check (live_version_number is null or live_version_number > 0),
  constraint quiz_event_drafts_content_object
    check (jsonb_typeof(content) = 'object')
);

create table if not exists public.quiz_event_versions (
  event_id text not null,
  version_number integer not null,
  schema_version smallint not null default 1,
  content jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid,
  primary key (event_id, version_number),
  constraint quiz_event_versions_schema_version_positive
    check (schema_version > 0),
  constraint quiz_event_versions_version_number_positive
    check (version_number > 0),
  constraint quiz_event_versions_content_object
    check (jsonb_typeof(content) = 'object')
);

alter table public.quiz_event_drafts enable row level security;
alter table public.quiz_event_versions enable row level security;

revoke all on table public.quiz_event_drafts
  from anon, authenticated;

revoke all on table public.quiz_event_versions
  from anon, authenticated;

grant select, insert, update, delete on table public.quiz_event_drafts
  to service_role;

grant select, insert, update, delete on table public.quiz_event_versions
  to service_role;

-- Backfill creates canonical draft/version rows only for already-published
-- events; future draft and publish writes happen through authoring functions.
with backfilled_events as (
  select
    event.id,
    event.slug,
    event.name,
    event.created_at,
    event.updated_at,
    event.published_at,
    jsonb_build_object(
      'id',
      event.id,
      'slug',
      event.slug,
      'name',
      event.name,
      'location',
      event.location,
      'estimatedMinutes',
      event.estimated_minutes,
      'raffleLabel',
      event.raffle_label,
      'intro',
      event.intro,
      'summary',
      event.summary,
      'feedbackMode',
      event.feedback_mode,
      'allowBackNavigation',
      event.allow_back_navigation,
      'allowRetake',
      event.allow_retake,
      'questions',
      (
        select coalesce(
          jsonb_agg(question_payload.question_json order by question_payload.display_order),
          '[]'::jsonb
        )
        from (
          select
            question.display_order,
            jsonb_strip_nulls(
              jsonb_build_object(
                'id',
                question.id,
                'sponsor',
                question.sponsor,
                'prompt',
                question.prompt,
                'selectionMode',
                question.selection_mode,
                'correctAnswerIds',
                (
                  select coalesce(
                    jsonb_agg(to_jsonb(option.id) order by option.display_order)
                    filter (where option.is_correct),
                    '[]'::jsonb
                  )
                  from public.quiz_question_options as option
                  where option.event_id = question.event_id
                    and option.question_id = question.id
                ),
                'explanation',
                question.explanation,
                'sponsorFact',
                question.sponsor_fact,
                'options',
                (
                  select coalesce(
                    jsonb_agg(
                      jsonb_build_object(
                        'id',
                        option.id,
                        'label',
                        option.label
                      )
                      order by option.display_order
                    ),
                    '[]'::jsonb
                  )
                  from public.quiz_question_options as option
                  where option.event_id = question.event_id
                    and option.question_id = question.id
                )
              )
            ) as question_json
          from public.quiz_questions as question
          where question.event_id = event.id
        ) as question_payload
      )
    ) as content
  from public.quiz_events as event
  where event.published_at is not null
),
inserted_drafts as (
  insert into public.quiz_event_drafts (
    id,
    slug,
    name,
    schema_version,
    content,
    live_version_number,
    created_at,
    updated_at
  )
  select
    id,
    slug,
    name,
    1,
    content,
    1,
    created_at,
    updated_at
  from backfilled_events
  on conflict (id) do nothing
  returning id
)
insert into public.quiz_event_versions (
  event_id,
  version_number,
  schema_version,
  content,
  published_at
)
select
  backfilled_events.id,
  1,
  1,
  backfilled_events.content,
  backfilled_events.published_at
from backfilled_events
on conflict (event_id, version_number) do nothing;
