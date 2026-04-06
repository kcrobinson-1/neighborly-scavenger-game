begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

-- Exercise the completion RPC at the database layer because this is where
-- idempotency, attempt numbering, and single-entitlement enforcement live.
create temp table first_attempt as
select *
from public.complete_quiz_and_award_entitlement(
  'test-event',
  'test-session',
  'test-request-1',
  '{"q1":["a"]}'::jsonb,
  5,
  1200
);

select is(
  (select attempt_number from first_attempt),
  1,
  'first completion starts at attempt number 1'
);

select is(
  (select entitlement_status from first_attempt),
  'new',
  'first completion creates a new entitlement'
);

select ok(
  (select raffle_eligible from first_attempt),
  'first completion is raffle eligible'
);

select is(
  (select count(*) from public.raffle_entitlements where event_id = 'test-event' and client_session_id = 'test-session'),
  1::bigint,
  'first completion creates exactly one entitlement row'
);

select is(
  (select count(*) from public.quiz_completions where event_id = 'test-event' and client_session_id = 'test-session'),
  1::bigint,
  'first completion creates exactly one completion row'
);

select is(
  (select first_completion_id::text from public.raffle_entitlements where event_id = 'test-event' and client_session_id = 'test-session'),
  (select completion_id::text from first_attempt),
  'entitlement points at the first completion row'
);

create temp table repeated_request as
select *
from public.complete_quiz_and_award_entitlement(
  'test-event',
  'test-session',
  'test-request-1',
  '{"q1":["a"]}'::jsonb,
  5,
  1200
);

select is(
  (select completion_id::text from repeated_request),
  (select completion_id::text from first_attempt),
  'repeating the same request id returns the original completion'
);

select is(
  (select attempt_number from repeated_request),
  1,
  'repeating the same request id does not increment the attempt number'
);

select is(
  (select count(*) from public.quiz_completions where event_id = 'test-event' and client_session_id = 'test-session'),
  1::bigint,
  'repeating the same request id does not create another completion row'
);

create temp table second_attempt as
select *
from public.complete_quiz_and_award_entitlement(
  'test-event',
  'test-session',
  'test-request-2',
  '{"q1":["a"]}'::jsonb,
  4,
  2400
);

select is(
  (select attempt_number from second_attempt),
  2,
  'a new request id increments the attempt number'
);

select is(
  (select entitlement_status from second_attempt),
  'existing',
  'a later request reuses the existing entitlement'
);

select ok(
  not (select raffle_eligible from second_attempt),
  'a later request does not earn a second raffle entry'
);

select is(
  (select verification_code from second_attempt),
  (select verification_code from first_attempt),
  'verification code stays stable for the same event and session'
);

select is(
  (select count(*) from public.quiz_completions where event_id = 'test-event' and client_session_id = 'test-session'),
  2::bigint,
  'a new request id creates a second completion row'
);

select is(
  (select count(*) from public.raffle_entitlements where event_id = 'test-event' and client_session_id = 'test-session'),
  1::bigint,
  'later attempts still reuse the original entitlement row'
);

select is(
  (select first_completion_id::text from public.raffle_entitlements where event_id = 'test-event' and client_session_id = 'test-session'),
  (select completion_id::text from first_attempt),
  'first_completion_id stays pinned to the original completion'
);

-- The hardening migration intentionally narrows execute privileges to service_role.
select ok(
  has_function_privilege(
    'service_role',
    'public.complete_quiz_and_award_entitlement(text, text, text, jsonb, integer, integer)',
    'EXECUTE'
  ),
  'service_role can execute the completion RPC'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.complete_quiz_and_award_entitlement(text, text, text, jsonb, integer, integer)',
    'EXECUTE'
  ),
  'anon cannot execute the completion RPC'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.complete_quiz_and_award_entitlement(text, text, text, jsonb, integer, integer)',
    'EXECUTE'
  ),
  'authenticated cannot execute the completion RPC'
);

select * from finish();
rollback;
