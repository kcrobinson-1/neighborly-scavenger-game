begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

insert into public.game_event_drafts (
  id,
  slug,
  event_code,
  name,
  content
)
values (
  'phase3-publish-event',
  'phase3-publish',
  'PPA',
  'Phase 3 Publish Event',
  jsonb_build_object(
    'id', 'phase3-publish-event',
    'slug', 'phase3-publish',
    'name', 'Phase 3 Publish Event',
    'location', 'Seattle',
    'estimatedMinutes', 2,
    'entitlementLabel', 'raffle ticket',
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
  $$ select event_id, slug, version_number from public.publish_game_event_draft('phase3-publish-event', '22222222-2222-4222-8222-222222222222') $$,
  $$ values ('phase3-publish-event'::text, 'phase3-publish'::text, 1) $$,
  'publish returns the published event and first version number'
);

reset role;

select is(
  (
    select live_version_number
    from public.game_event_drafts
    where id = 'phase3-publish-event'
  ),
  1,
  'publish updates the draft live version pointer'
);

select is(
  (
    select count(*)
    from public.game_event_versions
    where event_id = 'phase3-publish-event'
  ),
  1::bigint,
  'publish creates one immutable version'
);

select is(
  (
    select allow_back_navigation
    from public.game_events
    where id = 'phase3-publish-event'
  ),
  false,
  'publish projects event metadata into public game_events'
);

select is(
  (
    select event_code
    from public.game_events
    where id = 'phase3-publish-event'
  ),
  'PPA',
  'publish projects the event code into public game_events'
);

select is(
  (
    select count(*)
    from public.game_questions
    where event_id = 'phase3-publish-event'
  ),
  1::bigint,
  'publish projects draft questions into public game_questions'
);

select is(
  (
    select count(*)
    from public.game_question_options
    where event_id = 'phase3-publish-event'
      and question_id = 'q1'
      and is_correct
  ),
  1::bigint,
  'publish projects correct answer flags into public game_question_options'
);

update public.game_event_drafts
set
  name = 'Phase 3 Republished Event',
  content = jsonb_build_object(
    'id', 'phase3-publish-event',
    'slug', 'phase3-publish',
    'name', 'Phase 3 Republished Event',
    'location', 'Seattle',
    'estimatedMinutes', 3,
    'entitlementLabel', 'raffle ticket',
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
  $$ select event_id, slug, version_number from public.publish_game_event_draft('phase3-publish-event', '33333333-3333-4333-8333-333333333333') $$,
  $$ values ('phase3-publish-event'::text, 'phase3-publish'::text, 2) $$,
  'republish returns the next version number'
);

reset role;

select is(
  (
    select count(*)
    from public.game_questions
    where event_id = 'phase3-publish-event'
      and id = 'q1'
  ),
  0::bigint,
  'republish removes previous projected questions'
);

select is(
  (
    select count(*)
    from public.game_question_options
    where event_id = 'phase3-publish-event'
      and question_id = 'q2'
  ),
  3::bigint,
  'republish replaces projected options with the current draft'
);

select * from finish();
rollback;
