begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

select ok(
  exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename = 'quiz_event_drafts'
      and rowsecurity
  ),
  'quiz_event_drafts exists with row level security enabled'
);

select ok(
  exists (
    select 1
    from pg_tables
    where schemaname = 'public'
      and tablename = 'quiz_event_versions'
      and rowsecurity
  ),
  'quiz_event_versions exists with row level security enabled'
);

select ok(
  not has_table_privilege('anon', 'public.quiz_event_drafts', 'SELECT'),
  'anon cannot select authoring drafts'
);

select ok(
  not has_table_privilege('authenticated', 'public.quiz_event_drafts', 'SELECT'),
  'authenticated cannot select authoring drafts in phase 1'
);

select ok(
  not has_table_privilege('anon', 'public.quiz_event_versions', 'SELECT'),
  'anon cannot select authoring versions'
);

select ok(
  not has_table_privilege('authenticated', 'public.quiz_event_versions', 'SELECT'),
  'authenticated cannot select authoring versions in phase 1'
);

select ok(
  has_table_privilege('service_role', 'public.quiz_event_drafts', 'SELECT,INSERT,UPDATE,DELETE'),
  'service_role can manage authoring drafts'
);

select ok(
  has_table_privilege('service_role', 'public.quiz_event_versions', 'SELECT,INSERT,UPDATE,DELETE'),
  'service_role can manage authoring versions'
);

select is(
  (select count(*) from public.quiz_event_drafts),
  3::bigint,
  'published seeded events are backfilled into draft rows'
);

select is(
  (select count(*) from public.quiz_event_versions),
  3::bigint,
  'published seeded events are backfilled into version rows'
);

select is(
  (select count(*) from public.quiz_event_drafts where live_version_number = 1),
  3::bigint,
  'backfilled drafts point at version 1 as the live version'
);

select is(
  (
    select string_agg(question->>'id', ',' order by question_position)
    from public.quiz_event_drafts as draft
    cross join lateral jsonb_array_elements(draft.content->'questions')
      with ordinality as question(question, question_position)
    where draft.id = 'madrona-music-2026'
  ),
  'q1,q2,q3,q4,q5,q6',
  'backfilled draft preserves question order'
);

select is(
  (
    select string_agg(option->>'id', ',' order by option_position)
    from public.quiz_event_drafts as draft
    cross join lateral jsonb_array_elements(draft.content->'questions')
      as question(question_json)
    cross join lateral jsonb_array_elements(question.question_json->'options')
      with ordinality as option(option, option_position)
    where draft.id = 'madrona-music-2026'
      and question.question_json->>'id' = 'q1'
  ),
  'a,b,c',
  'backfilled draft preserves option order'
);

select is(
  (
    select string_agg(correct_answer_id, ',' order by correct_position)
    from public.quiz_event_drafts as draft
    cross join lateral jsonb_array_elements(draft.content->'questions')
      as question(question_json)
    cross join lateral jsonb_array_elements_text(question.question_json->'correctAnswerIds')
      with ordinality as correct(correct_answer_id, correct_position)
    where draft.id = 'community-checklist-2026'
      and question.question_json->>'id' = 'q1'
  ),
  'a,c,d',
  'backfilled draft preserves multi-select correct-answer order'
);

select ok(
  (
    select draft.content = version.content
    from public.quiz_event_drafts as draft
    join public.quiz_event_versions as version
      on version.event_id = draft.id
     and version.version_number = 1
    where draft.id = 'madrona-music-2026'
  ),
  'backfilled version snapshot matches the current draft content'
);

select is(
  (
    select count(*)
    from public.quiz_events
    where slug in ('first-sample', 'sponsor-spotlight', 'community-checklist')
  ),
  3::bigint,
  'existing public published events remain available after backfill'
);

select * from finish();
rollback;
