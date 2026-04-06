begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

select ok(
  has_table_privilege('anon', 'public.quiz_events', 'SELECT'),
  'anon can select published quiz events'
);

select ok(
  has_table_privilege('anon', 'public.quiz_questions', 'SELECT'),
  'anon can select published quiz questions'
);

select ok(
  has_table_privilege('anon', 'public.quiz_question_options', 'SELECT'),
  'anon can select published quiz question options'
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
  published_at
)
values (
  'hidden-event',
  'hidden-event',
  'Hidden Event',
  'Seattle',
  2,
  'raffle ticket',
  'Hidden intro',
  'Hidden summary',
  'final_score_reveal',
  true,
  true,
  null
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
  'hidden-event',
  'q1',
  1,
  'Hidden Sponsor',
  'Hidden prompt?',
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
  'hidden-event',
  'q1',
  'a',
  1,
  'Hidden option',
  true
);

set local role anon;

select is(
  (select count(*) from public.quiz_events where slug = 'first-sample'),
  1::bigint,
  'anon can read the published featured event'
);

select is(
  (
    select count(*)
    from public.quiz_events
    where slug in ('first-sample', 'sponsor-spotlight', 'community-checklist')
  ),
  3::bigint,
  'anon can read the seeded published demo events'
);

select is(
  (select count(*) from public.quiz_events where slug = 'hidden-event'),
  0::bigint,
  'anon cannot read unpublished events'
);

select is(
  (select count(*) from public.quiz_questions where event_id = 'hidden-event'),
  0::bigint,
  'anon cannot read unpublished event questions'
);

select is(
  (
    select count(*)
    from public.quiz_question_options
    where event_id = 'hidden-event'
  ),
  0::bigint,
  'anon cannot read unpublished event options'
);

select is(
  (
    select string_agg(id, ',' order by display_order)
    from public.quiz_questions
    where event_id = 'madrona-music-2026'
  ),
  'q1,q2,q3,q4,q5,q6',
  'published featured questions keep display order'
);

select is(
  (
    select string_agg(id, ',' order by display_order)
    from public.quiz_question_options
    where event_id = 'madrona-music-2026'
      and question_id = 'q1'
  ),
  'a,b,c',
  'published question options keep display order'
);

select is(
  (
    select count(*)
    from public.quiz_question_options
    where event_id = 'madrona-music-2026'
      and question_id = 'q1'
      and is_correct
  ),
  1::bigint,
  'published single-select questions preserve correct-answer flags'
);

select is(
  (
    select count(*)
    from public.quiz_question_options
    where event_id = 'community-checklist-2026'
      and question_id = 'q1'
      and is_correct
  ),
  3::bigint,
  'published multi-select questions preserve correct-answer flags'
);

reset role;

create temp table seeded_event_completion as
select *
from public.complete_quiz_and_award_entitlement(
  'madrona-music-2026',
  'seeded-test-session',
  'seeded-test-request',
  '{"q1":["a"]}'::jsonb,
  1,
  900
);

select is(
  (select count(*) from seeded_event_completion),
  1::bigint,
  'completion RPC still works with a seeded event id'
);

select is(
  (select entitlement_status from seeded_event_completion),
  'new',
  'seeded event completion still awards the first entitlement'
);

select * from finish();
rollback;
