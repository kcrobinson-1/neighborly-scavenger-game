alter table public.quiz_event_drafts
  add column if not exists last_published_at timestamptz,
  add column if not exists last_published_by uuid;

create table if not exists public.quiz_event_audit_log (
  id bigint generated always as identity primary key,
  event_id text not null,
  action text not null,
  actor_id uuid,
  version_number integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint quiz_event_audit_log_action_check
    check (action in ('publish', 'unpublish')),
  constraint quiz_event_audit_log_version_number_positive
    check (version_number is null or version_number > 0),
  constraint quiz_event_audit_log_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

alter table public.quiz_event_audit_log enable row level security;

revoke all on table public.quiz_event_audit_log
  from anon, authenticated;

grant select, insert on table public.quiz_event_audit_log
  to service_role;

revoke insert, update, delete on table public.quiz_event_drafts
  from authenticated;

create or replace function public.set_quiz_event_draft_audit_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_request_user_id uuid;
begin
  new.updated_at = clock_timestamp();
  v_request_user_id = public.current_request_user_id();

  if v_request_user_id is not null then
    new.last_saved_by = v_request_user_id;
  end if;

  return new;
end;
$$;

create or replace function public.publish_quiz_event_draft(
  p_event_id text,
  p_published_by uuid
)
returns table (
  event_id text,
  slug text,
  version_number integer,
  published_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public.quiz_event_drafts%rowtype;
  v_content jsonb;
  v_next_version integer;
  v_published_at timestamptz := now();
begin
  select *
  into v_draft
  from public.quiz_event_drafts
  where id = p_event_id
  for update;

  if not found then
    raise exception 'draft_not_found';
  end if;

  v_content = v_draft.content;

  if v_content ->> 'id' is distinct from v_draft.id
    or v_content ->> 'slug' is distinct from v_draft.slug
    or v_content ->> 'name' is distinct from v_draft.name then
    raise exception 'invalid_draft_identity';
  end if;

  if exists (
    select 1
    from public.quiz_events as event
    where event.slug = v_draft.slug
      and event.id <> v_draft.id
  ) then
    raise exception 'slug_collision';
  end if;

  select coalesce(max(version.version_number), 0) + 1
  into v_next_version
  from public.quiz_event_versions as version
  where version.event_id = v_draft.id;

  insert into public.quiz_event_versions (
    event_id,
    version_number,
    schema_version,
    content,
    published_at,
    published_by
  )
  values (
    v_draft.id,
    v_next_version,
    v_draft.schema_version,
    v_content,
    v_published_at,
    p_published_by
  );

  insert into public.quiz_events (
    id,
    slug,
    name,
    location,
    estimated_minutes,
    raffle_label,
    intro,
    summary,
    feedback_mode,
    allow_back_navigation,
    allow_retake,
    published_at,
    created_at,
    updated_at
  )
  values (
    v_draft.id,
    v_draft.slug,
    v_draft.name,
    v_content ->> 'location',
    (v_content ->> 'estimatedMinutes')::integer,
    v_content ->> 'raffleLabel',
    v_content ->> 'intro',
    v_content ->> 'summary',
    v_content ->> 'feedbackMode',
    coalesce((v_content ->> 'allowBackNavigation')::boolean, true),
    coalesce((v_content ->> 'allowRetake')::boolean, true),
    v_published_at,
    coalesce(v_draft.created_at, v_published_at),
    v_published_at
  )
  on conflict (id) do update
  set
    slug = excluded.slug,
    name = excluded.name,
    location = excluded.location,
    estimated_minutes = excluded.estimated_minutes,
    raffle_label = excluded.raffle_label,
    intro = excluded.intro,
    summary = excluded.summary,
    feedback_mode = excluded.feedback_mode,
    allow_back_navigation = excluded.allow_back_navigation,
    allow_retake = excluded.allow_retake,
    published_at = excluded.published_at,
    updated_at = excluded.updated_at;

  delete from public.quiz_questions
  where quiz_questions.event_id = v_draft.id;

  insert into public.quiz_questions (
    event_id,
    id,
    display_order,
    sponsor,
    prompt,
    selection_mode,
    explanation,
    sponsor_fact
  )
  select
    v_draft.id,
    question.value ->> 'id',
    question.ordinality::integer,
    question.value ->> 'sponsor',
    question.value ->> 'prompt',
    question.value ->> 'selectionMode',
    question.value ->> 'explanation',
    question.value ->> 'sponsorFact'
  from jsonb_array_elements(v_content -> 'questions') with ordinality as question(value, ordinality);

  insert into public.quiz_question_options (
    event_id,
    question_id,
    id,
    display_order,
    label,
    is_correct
  )
  select
    v_draft.id,
    question.value ->> 'id',
    option.value ->> 'id',
    option.ordinality::integer,
    option.value ->> 'label',
    exists (
      select 1
      from jsonb_array_elements_text(question.value -> 'correctAnswerIds') as correct_answer(id)
      where correct_answer.id = option.value ->> 'id'
    )
  from jsonb_array_elements(v_content -> 'questions') with ordinality as question(value, question_ordinality)
  cross join lateral jsonb_array_elements(question.value -> 'options') with ordinality as option(value, ordinality);

  update public.quiz_event_drafts
  set
    live_version_number = v_next_version,
    last_published_at = v_published_at,
    last_published_by = p_published_by
  where id = v_draft.id;

  insert into public.quiz_event_audit_log (
    event_id,
    action,
    actor_id,
    version_number,
    metadata,
    created_at
  )
  values (
    v_draft.id,
    'publish',
    p_published_by,
    v_next_version,
    jsonb_build_object(
      'slug', v_draft.slug,
      'schemaVersion', v_draft.schema_version
    ),
    v_published_at
  );

  return query
  select
    v_draft.id,
    v_draft.slug,
    v_next_version,
    v_published_at;
end;
$$;

create or replace function public.unpublish_quiz_event(
  p_event_id text,
  p_actor_id uuid
)
returns table (
  event_id text,
  unpublished_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public.quiz_event_drafts%rowtype;
  v_unpublished_at timestamptz := now();
begin
  select *
  into v_draft
  from public.quiz_event_drafts
  where id = p_event_id
  for update;

  if not found then
    raise exception 'draft_not_found';
  end if;

  update public.quiz_events
  set
    published_at = null,
    updated_at = v_unpublished_at
  where id = v_draft.id
    and published_at is not null;

  if not found then
    raise exception 'live_event_not_found';
  end if;

  insert into public.quiz_event_audit_log (
    event_id,
    action,
    actor_id,
    version_number,
    metadata,
    created_at
  )
  values (
    v_draft.id,
    'unpublish',
    p_actor_id,
    v_draft.live_version_number,
    jsonb_build_object('slug', v_draft.slug),
    v_unpublished_at
  );

  return query
  select
    v_draft.id,
    v_unpublished_at;
end;
$$;

revoke all on function public.publish_quiz_event_draft(text, uuid)
  from public;
revoke all on function public.unpublish_quiz_event(text, uuid)
  from public;
revoke all on function public.publish_quiz_event_draft(text, uuid)
  from anon, authenticated;
revoke all on function public.unpublish_quiz_event(text, uuid)
  from anon, authenticated;

grant execute on function public.publish_quiz_event_draft(text, uuid)
  to service_role;
grant execute on function public.unpublish_quiz_event(text, uuid)
  to service_role;
