begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

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
  'UPA',
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

create temp table unpublish_audit_first_publish as
select *
from public.publish_game_event_draft(
  'phase3-publish-event',
  '22222222-2222-4222-8222-222222222222'
);

reset role;

select is(
  (
    select count(*)
    from public.game_event_audit_log
    where event_id = 'phase3-publish-event'
      and action = 'publish'
      and version_number = 1
      and actor_id = '22222222-2222-4222-8222-222222222222'
  ),
  1::bigint,
  'publish records audit metadata'
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

create temp table unpublish_audit_second_publish as
select *
from public.publish_game_event_draft(
  'phase3-publish-event',
  '33333333-3333-4333-8333-333333333333'
);

select results_eq(
  $$ select event_id from public.unpublish_game_event('phase3-publish-event', '44444444-4444-4444-8444-444444444444') $$,
  $$ values ('phase3-publish-event'::text) $$,
  'unpublish returns the unpublished event id'
);

reset role;

set local role anon;

select is(
  (
    select count(*)
    from public.game_events
    where id = 'phase3-publish-event'
  ),
  0::bigint,
  'unpublish hides the event from public reads'
);

reset role;

select is(
  (
    select count(*)
    from public.game_event_versions
    where event_id = 'phase3-publish-event'
  ),
  2::bigint,
  'unpublish preserves immutable version history'
);

select is(
  (
    select count(*)
    from public.game_event_audit_log
    where event_id = 'phase3-publish-event'
      and action = 'unpublish'
      and actor_id = '44444444-4444-4444-8444-444444444444'
  ),
  1::bigint,
  'unpublish records audit metadata'
);

select * from finish();
rollback;
