begin;

create extension if not exists pgtap with schema extensions;

select plan(25);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'game_event_drafts'
      and column_name = 'event_code'
      and is_nullable = 'NO'
  ),
  'game_event_drafts has a required event_code column'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'game_events'
      and column_name = 'event_code'
      and is_nullable = 'NO'
  ),
  'game_events has a required event_code column'
);

select is_empty(
  $$
    select 1
    from (
      select
        event_code,
        chr(65 + (((row_number() over (order by created_at asc, id asc) - 1) / 676)::integer % 26)) ||
        chr(65 + (((row_number() over (order by created_at asc, id asc) - 1) / 26)::integer % 26)) ||
        chr(65 + ((row_number() over (order by created_at asc, id asc) - 1)::integer % 26)) as expected_event_code
      from public.game_event_drafts
    ) as ordered_drafts
    where event_code <> expected_event_code
  $$,
  'backfilled draft event codes follow deterministic base-26 ordering'
);

select is_empty(
  $$
    select 1
    from public.game_events as event
    join public.game_event_drafts as draft
      on draft.id = event.id
    where event.event_code <> draft.event_code
  $$,
  'published event codes mirror their draft rows after backfill'
);

select ok(
  public.generate_random_event_code() ~ '^[A-Z]{3}$',
  'generate_random_event_code returns a 3-letter uppercase code'
);

select ok(
  has_function_privilege('service_role', 'public.generate_random_event_code()', 'EXECUTE'),
  'service_role can execute generate_random_event_code'
);

select ok(
  not has_function_privilege('authenticated', 'public.generate_random_event_code()', 'EXECUTE'),
  'authenticated users cannot execute generate_random_event_code directly'
);

select throws_ok(
  format(
    $$
      insert into public.game_event_drafts (id, slug, event_code, name, content)
      values (
        'invalid-draft-%s',
        'invalid-draft-%s',
        %L,
        'Invalid Draft',
        '{}'::jsonb
      )
    $$,
    invalid_case.ordinality,
    invalid_case.ordinality,
    invalid_case.event_code
  ),
  '23514',
  null,
  format('game_event_drafts rejects invalid event code: %s', invalid_case.label)
)
from (
  select
    event_code,
    label,
    row_number() over () as ordinality
  from (
    values
      ('AA', 'too short'),
      ('AAAA', 'too long'),
      ('abc', 'lowercase'),
      ('A1C', 'digit'),
      ('A-C', 'hyphen'),
      ('A C', 'whitespace')
  ) as cases(event_code, label)
) as invalid_case;

select throws_ok(
  format(
    $$
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
        feedback_mode
      )
      values (
        'invalid-event-%s',
        'invalid-event-%s',
        %L,
        'Invalid Event',
        'Seattle',
        2,
        'reward ticket',
        'Intro',
        'Summary',
        'final_score_reveal'
      )
    $$,
    invalid_case.ordinality,
    invalid_case.ordinality,
    invalid_case.event_code
  ),
  '23514',
  null,
  format('game_events rejects invalid event code: %s', invalid_case.label)
)
from (
  select
    event_code,
    label,
    row_number() over () as ordinality
  from (
    values
      ('AA', 'too short'),
      ('AAAA', 'too long'),
      ('abc', 'lowercase'),
      ('A1C', 'digit'),
      ('A-C', 'hyphen'),
      ('A C', 'whitespace')
  ) as cases(event_code, label)
) as invalid_case;

select throws_ok(
  $$
    insert into public.game_event_drafts (id, slug, name, content)
    values ('missing-code-draft', 'missing-code-draft', 'Missing Code Draft', '{}'::jsonb)
  $$,
  '23502',
  null,
  'game_event_drafts requires event_code'
);

select throws_ok(
  $$
    insert into public.game_events (
      id,
      slug,
      name,
      location,
      estimated_minutes,
      entitlement_label,
      intro,
      summary,
      feedback_mode
    )
    values (
      'missing-code-event',
      'missing-code-event',
      'Missing Code Event',
      'Seattle',
      2,
      'reward ticket',
      'Intro',
      'Summary',
      'final_score_reveal'
    )
  $$,
  '23502',
  null,
  'game_events requires event_code'
);

insert into public.game_event_drafts (id, slug, event_code, name, content)
values
  ('unique-draft-one', 'unique-draft-one', 'UZD', 'Unique Draft One', '{}'::jsonb);

select throws_ok(
  $$
    insert into public.game_event_drafts (id, slug, event_code, name, content)
    values ('unique-draft-two', 'unique-draft-two', 'UZD', 'Unique Draft Two', '{}'::jsonb)
  $$,
  '23505',
  null,
  'game_event_drafts enforces unique event codes'
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
  feedback_mode
)
values
  (
    'unique-event-one',
    'unique-event-one',
    'UZE',
    'Unique Event One',
    'Seattle',
    2,
    'reward ticket',
    'Intro',
    'Summary',
    'final_score_reveal'
  );

select throws_ok(
  $$
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
      feedback_mode
    )
    values (
      'unique-event-two',
      'unique-event-two',
      'UZE',
      'Unique Event Two',
      'Seattle',
      2,
      'reward ticket',
      'Intro',
      'Summary',
      'final_score_reveal'
    )
  $$,
  '23505',
  null,
  'game_events enforces unique event codes'
);

insert into public.game_event_drafts (id, slug, event_code, name, content)
values
  ('lock-test-draft', 'lock-test-draft', 'LCK', 'Lock Test Draft', '{}'::jsonb);

select lives_ok(
  $$
    update public.game_event_drafts
    set event_code = 'LCD'
    where id = 'lock-test-draft'
  $$,
  'event_code can change before first publish'
);

update public.game_event_drafts
set live_version_number = 1
where id = 'lock-test-draft';

select throws_ok(
  $$
    update public.game_event_drafts
    set event_code = 'LCE'
    where id = 'lock-test-draft'
  $$,
  'P0001',
  'event_code_locked',
  'event_code cannot change after first publish'
);

select * from finish();
rollback;
