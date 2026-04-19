begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

select ok(
  exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename = 'game_event_audit_log'
      and rowsecurity
  ),
  'game_event_audit_log keeps row level security enabled'
);

select ok(
  not has_table_privilege('anon', 'public.game_event_audit_log', 'SELECT'),
  'anon cannot read game event audit rows'
);

select ok(
  not has_table_privilege('authenticated', 'public.game_event_audit_log', 'SELECT'),
  'authenticated users cannot read game event audit rows directly'
);

select ok(
  has_table_privilege('service_role', 'public.game_event_audit_log', 'SELECT,INSERT'),
  'service_role can read and insert game event audit rows'
);

select ok(
  not has_function_privilege('authenticated', 'public.publish_game_event_draft(text, uuid)', 'EXECUTE'),
  'authenticated users cannot execute publish directly'
);

select ok(
  has_function_privilege('service_role', 'public.publish_game_event_draft(text, uuid)', 'EXECUTE'),
  'service_role can execute publish'
);

select ok(
  has_function_privilege('service_role', 'public.unpublish_game_event(text, uuid)', 'EXECUTE'),
  'service_role can execute unpublish'
);

insert into public.game_event_drafts (
  id,
  slug,
  event_code,
  name,
  content,
  live_version_number
)
values (
  'phase3-failed-publish',
  'phase3-failed-publish',
  'PFB',
  'Phase 3 Failed Publish',
  jsonb_build_object(
    'id', 'phase3-failed-publish',
    'slug', 'phase3-failed-publish',
    'name', 'Phase 3 Failed Publish',
    'location', 'Seattle',
    'estimatedMinutes', 2,
    'entitlementLabel', 'raffle ticket',
    'intro', 'Intro',
    'summary', 'Summary',
    'feedbackMode', 'final_score_reveal',
    'questions', jsonb_build_array(
      jsonb_build_object(
        'id', 'q1',
        'sponsor', 'Sponsor',
        'prompt', 'Prompt?',
        'selectionMode', 'single',
        'correctAnswerIds', jsonb_build_array('a'),
        'options', jsonb_build_array(
          jsonb_build_object('id', 'a', 'label', 'Option A')
        )
      )
    )
  ),
  1
);

insert into public.game_event_versions (
  event_id,
  version_number,
  content
)
select
  id,
  1,
  content
from public.game_event_drafts
where id = 'phase3-failed-publish';

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
  published_at
)
values (
  'phase3-failed-publish',
  'phase3-failed-publish',
  'PFB',
  'Phase 3 Failed Publish',
  'Seattle',
  2,
  'raffle ticket',
  'Intro',
  'Summary',
  'final_score_reveal',
  now()
);

insert into public.game_questions (
  event_id,
  id,
  display_order,
  sponsor,
  prompt,
  selection_mode
)
values (
  'phase3-failed-publish',
  'q1',
  1,
  'Sponsor',
  'Prompt?',
  'single'
);

insert into public.game_question_options (
  event_id,
  question_id,
  id,
  display_order,
  label,
  is_correct
)
values (
  'phase3-failed-publish',
  'q1',
  'a',
  1,
  'Option A',
  true
);

update public.game_event_drafts
set content = jsonb_set(content, '{questions,0,selectionMode}', to_jsonb('broken'::text))
where id = 'phase3-failed-publish';

set local role service_role;

select throws_ok(
  $$ select * from public.publish_game_event_draft('phase3-failed-publish', '55555555-5555-4555-8555-555555555555') $$,
  '23514',
  null,
  'failed publish raises before committing the public projection'
);

reset role;

select is(
  (
    select count(*)
    from public.game_event_versions
    where event_id = 'phase3-failed-publish'
  ),
  1::bigint,
  'failed publish does not create a new version'
);

select is(
  (
    select selection_mode
    from public.game_questions
    where event_id = 'phase3-failed-publish'
      and id = 'q1'
  ),
  'single',
  'failed publish leaves existing public questions unchanged'
);

select * from finish();
rollback;
