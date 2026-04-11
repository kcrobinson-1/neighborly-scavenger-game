begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

select ok(
  exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename = 'quiz_event_audit_log'
      and rowsecurity
  ),
  'quiz_event_audit_log keeps row level security enabled'
);

select ok(
  not has_table_privilege('anon', 'public.quiz_event_audit_log', 'SELECT'),
  'anon cannot read quiz event audit rows'
);

select ok(
  not has_table_privilege('authenticated', 'public.quiz_event_audit_log', 'SELECT'),
  'authenticated users cannot read quiz event audit rows directly'
);

select ok(
  has_table_privilege('service_role', 'public.quiz_event_audit_log', 'SELECT,INSERT'),
  'service_role can read and insert quiz event audit rows'
);

select ok(
  not has_function_privilege('authenticated', 'public.publish_quiz_event_draft(text, uuid)', 'EXECUTE'),
  'authenticated users cannot execute publish directly'
);

select ok(
  has_function_privilege('service_role', 'public.publish_quiz_event_draft(text, uuid)', 'EXECUTE'),
  'service_role can execute publish'
);

select ok(
  has_function_privilege('service_role', 'public.unpublish_quiz_event(text, uuid)', 'EXECUTE'),
  'service_role can execute unpublish'
);

insert into public.quiz_event_drafts (
  id,
  slug,
  name,
  content
)
values (
  'phase3-publish-event',
  'phase3-publish',
  'Phase 3 Publish Event',
  jsonb_build_object(
    'id', 'phase3-publish-event',
    'slug', 'phase3-publish',
    'name', 'Phase 3 Publish Event',
    'location', 'Seattle',
    'estimatedMinutes', 2,
    'raffleLabel', 'raffle ticket',
    'intro', 'Intro',
    'summary', 'Summary',
    'feedbackMode', 'final_score_reveal',
    'allowBackNavigation', false,
    'allowRetake', true,
    'questions', jsonb_build_array(
      jsonb_build_object(
        'id', 'q1',
        'sponsor', 'Sponsor One',
        'prompt', 'First prompt?',
        'selectionMode', 'single',
        'correctAnswerIds', jsonb_build_array('a'),
        'explanation', 'Because A is right.',
        'options', jsonb_build_array(
          jsonb_build_object('id', 'a', 'label', 'Option A'),
          jsonb_build_object('id', 'b', 'label', 'Option B')
        )
      )
    )
  )
);

set local role service_role;

select results_eq(
  $$ select event_id, slug, version_number from public.publish_quiz_event_draft('phase3-publish-event', '22222222-2222-4222-8222-222222222222') $$,
  $$ values ('phase3-publish-event'::text, 'phase3-publish'::text, 1) $$,
  'publish returns the published event and first version number'
);

reset role;

select is(
  (
    select live_version_number
    from public.quiz_event_drafts
    where id = 'phase3-publish-event'
  ),
  1,
  'publish updates the draft live version pointer'
);

select is(
  (
    select count(*)
    from public.quiz_event_versions
    where event_id = 'phase3-publish-event'
  ),
  1::bigint,
  'publish creates one immutable version'
);

select is(
  (
    select allow_back_navigation
    from public.quiz_events
    where id = 'phase3-publish-event'
  ),
  false,
  'publish projects event metadata into public quiz_events'
);

select is(
  (
    select count(*)
    from public.quiz_questions
    where event_id = 'phase3-publish-event'
  ),
  1::bigint,
  'publish projects draft questions into public quiz_questions'
);

select is(
  (
    select count(*)
    from public.quiz_question_options
    where event_id = 'phase3-publish-event'
      and question_id = 'q1'
      and is_correct
  ),
  1::bigint,
  'publish projects correct answer flags into public quiz_question_options'
);

select is(
  (
    select count(*)
    from public.quiz_event_audit_log
    where event_id = 'phase3-publish-event'
      and action = 'publish'
      and version_number = 1
      and actor_id = '22222222-2222-4222-8222-222222222222'
  ),
  1::bigint,
  'publish records audit metadata'
);

update public.quiz_event_drafts
set
  name = 'Phase 3 Republished Event',
  content = jsonb_build_object(
    'id', 'phase3-publish-event',
    'slug', 'phase3-publish',
    'name', 'Phase 3 Republished Event',
    'location', 'Seattle',
    'estimatedMinutes', 3,
    'raffleLabel', 'raffle ticket',
    'intro', 'Updated intro',
    'summary', 'Updated summary',
    'feedbackMode', 'final_score_reveal',
    'questions', jsonb_build_array(
      jsonb_build_object(
        'id', 'q2',
        'sponsor', 'Sponsor Two',
        'prompt', 'Second prompt?',
        'selectionMode', 'multiple',
        'correctAnswerIds', jsonb_build_array('a', 'c'),
        'sponsorFact', 'Sponsor fact.',
        'options', jsonb_build_array(
          jsonb_build_object('id', 'a', 'label', 'Option A'),
          jsonb_build_object('id', 'b', 'label', 'Option B'),
          jsonb_build_object('id', 'c', 'label', 'Option C')
        )
      )
    )
  )
where id = 'phase3-publish-event';

set local role service_role;

select results_eq(
  $$ select event_id, slug, version_number from public.publish_quiz_event_draft('phase3-publish-event', '33333333-3333-4333-8333-333333333333') $$,
  $$ values ('phase3-publish-event'::text, 'phase3-publish'::text, 2) $$,
  'republish returns the next version number'
);

reset role;

select is(
  (
    select count(*)
    from public.quiz_questions
    where event_id = 'phase3-publish-event'
      and id = 'q1'
  ),
  0::bigint,
  'republish removes previous projected questions'
);

select is(
  (
    select count(*)
    from public.quiz_question_options
    where event_id = 'phase3-publish-event'
      and question_id = 'q2'
  ),
  3::bigint,
  'republish replaces projected options with the current draft'
);

set local role service_role;

select results_eq(
  $$ select event_id from public.unpublish_quiz_event('phase3-publish-event', '44444444-4444-4444-8444-444444444444') $$,
  $$ values ('phase3-publish-event'::text) $$,
  'unpublish returns the unpublished event id'
);

reset role;

set local role anon;

select is(
  (
    select count(*)
    from public.quiz_events
    where id = 'phase3-publish-event'
  ),
  0::bigint,
  'unpublish hides the event from public reads'
);

reset role;

select is(
  (
    select count(*)
    from public.quiz_event_versions
    where event_id = 'phase3-publish-event'
  ),
  2::bigint,
  'unpublish preserves immutable version history'
);

select is(
  (
    select count(*)
    from public.quiz_event_audit_log
    where event_id = 'phase3-publish-event'
      and action = 'unpublish'
      and actor_id = '44444444-4444-4444-8444-444444444444'
  ),
  1::bigint,
  'unpublish records audit metadata'
);

insert into public.quiz_event_drafts (
  id,
  slug,
  name,
  content,
  live_version_number
)
values (
  'phase3-failed-publish',
  'phase3-failed-publish',
  'Phase 3 Failed Publish',
  jsonb_build_object(
    'id', 'phase3-failed-publish',
    'slug', 'phase3-failed-publish',
    'name', 'Phase 3 Failed Publish',
    'location', 'Seattle',
    'estimatedMinutes', 2,
    'raffleLabel', 'raffle ticket',
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

insert into public.quiz_event_versions (
  event_id,
  version_number,
  content
)
select
  id,
  1,
  content
from public.quiz_event_drafts
where id = 'phase3-failed-publish';

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
  published_at
)
values (
  'phase3-failed-publish',
  'phase3-failed-publish',
  'Phase 3 Failed Publish',
  'Seattle',
  2,
  'raffle ticket',
  'Intro',
  'Summary',
  'final_score_reveal',
  now()
);

insert into public.quiz_questions (
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

insert into public.quiz_question_options (
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

update public.quiz_event_drafts
set content = jsonb_set(content, '{questions,0,selectionMode}', to_jsonb('broken'::text))
where id = 'phase3-failed-publish';

set local role service_role;

select throws_ok(
  $$ select * from public.publish_quiz_event_draft('phase3-failed-publish', '55555555-5555-4555-8555-555555555555') $$,
  '23514',
  null,
  'failed publish raises before committing the public projection'
);

reset role;

select is(
  (
    select count(*)
    from public.quiz_event_versions
    where event_id = 'phase3-failed-publish'
  ),
  1::bigint,
  'failed publish does not create a new version'
);

select is(
  (
    select selection_mode
    from public.quiz_questions
    where event_id = 'phase3-failed-publish'
      and id = 'q1'
  ),
  'single',
  'failed publish leaves existing public questions unchanged'
);

select * from finish();
rollback;
