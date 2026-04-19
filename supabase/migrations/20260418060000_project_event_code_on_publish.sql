-- Keep publish compatible with the new NOT NULL game_events.event_code column.

create or replace function public.publish_game_event_draft(
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
  v_draft public.game_event_drafts%rowtype;
  v_content jsonb;
  v_next_version integer;
  v_published_at timestamptz := now();
begin
  -- Lock the draft row so concurrent publishes cannot reuse the same version
  -- number or interleave public projection updates.
  select *
  into v_draft
  from public.game_event_drafts
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
    from public.game_events as event
    where event.slug = v_draft.slug
      and event.id <> v_draft.id
  ) then
    raise exception 'slug_collision';
  end if;

  select coalesce(max(version.version_number), 0) + 1
  into v_next_version
  from public.game_event_versions as version
  where version.event_id = v_draft.id;

  insert into public.game_event_versions (
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

  insert into public.game_events (
    id,
    slug,
    event_code,
    name,
    location,
    estimated_minutes,
    entitlement_label,
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
    v_draft.event_code,
    v_draft.name,
    v_content ->> 'location',
    (v_content ->> 'estimatedMinutes')::integer,
    v_content ->> 'entitlementLabel',
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
    event_code = excluded.event_code,
    name = excluded.name,
    location = excluded.location,
    estimated_minutes = excluded.estimated_minutes,
    entitlement_label = excluded.entitlement_label,
    intro = excluded.intro,
    summary = excluded.summary,
    feedback_mode = excluded.feedback_mode,
    allow_back_navigation = excluded.allow_back_navigation,
    allow_retake = excluded.allow_retake,
    published_at = excluded.published_at,
    updated_at = excluded.updated_at;

  delete from public.game_questions
  where game_questions.event_id = v_draft.id;

  -- Replace the question and option projection from the draft JSON in this
  -- function's transaction; any constraint failure rolls the whole publish back.
  insert into public.game_questions (
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

  insert into public.game_question_options (
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

  update public.game_event_drafts
  set
    live_version_number = v_next_version,
    last_published_at = v_published_at,
    last_published_by = p_published_by
  where id = v_draft.id;

  insert into public.game_event_audit_log (
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
