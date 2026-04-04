create extension if not exists pgcrypto;

create or replace function public.generate_neighborly_verification_code()
returns text
language plpgsql
as $$
begin
  return 'MMP-' || upper(substring(encode(gen_random_bytes(4), 'hex') from 1 for 8));
end;
$$;

create table if not exists public.raffle_entitlements (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  client_session_id text not null,
  first_completion_id uuid,
  verification_code text not null,
  created_at timestamptz not null default now(),
  status text not null default 'active',
  constraint raffle_entitlements_status_check
    check (status in ('active', 'revoked')),
  constraint raffle_entitlements_event_session_unique
    unique (event_id, client_session_id)
);

create table if not exists public.quiz_completions (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  client_session_id text not null,
  request_id text not null,
  attempt_number integer not null,
  submitted_answers jsonb not null,
  score integer not null,
  completed_at timestamptz not null default now(),
  duration_ms integer not null,
  verification_code text not null,
  entitlement_awarded boolean not null default false,
  entitlement_id uuid not null references public.raffle_entitlements (id) on delete restrict,
  constraint quiz_completions_attempt_positive check (attempt_number > 0),
  constraint quiz_completions_duration_non_negative check (duration_ms >= 0),
  constraint quiz_completions_event_session_attempt_unique
    unique (event_id, client_session_id, attempt_number),
  constraint quiz_completions_event_session_request_unique
    unique (event_id, client_session_id, request_id)
);

alter table public.raffle_entitlements
  add constraint raffle_entitlements_first_completion_fk
  foreign key (first_completion_id)
  references public.quiz_completions (id)
  on delete restrict;

create index if not exists quiz_completions_event_session_idx
  on public.quiz_completions (event_id, client_session_id);

alter table public.raffle_entitlements enable row level security;
alter table public.quiz_completions enable row level security;

create or replace function public.complete_quiz_and_award_entitlement(
  p_event_id text,
  p_client_session_id text,
  p_request_id text,
  p_submitted_answers jsonb,
  p_score integer,
  p_duration_ms integer
)
returns table (
  completion_id uuid,
  attempt_number integer,
  score integer,
  entitlement_status text,
  verification_code text,
  entitlement_created_at timestamptz,
  raffle_eligible boolean,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_completion public.quiz_completions%rowtype;
  v_entitlement public.raffle_entitlements%rowtype;
  v_completion public.quiz_completions%rowtype;
  v_attempt_number integer;
  v_entitlement_status text;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(p_event_id || ':' || p_client_session_id, 0)
  );

  select *
  into v_existing_completion
  from public.quiz_completions
  where event_id = p_event_id
    and client_session_id = p_client_session_id
    and request_id = p_request_id;

  if found then
    select *
    into v_entitlement
    from public.raffle_entitlements
    where id = v_existing_completion.entitlement_id;

    return query
    select
      v_existing_completion.id,
      v_existing_completion.attempt_number,
      v_existing_completion.score,
      case
        when v_existing_completion.entitlement_awarded then 'new'
        else 'existing'
      end,
      v_existing_completion.verification_code,
      v_entitlement.created_at,
      v_existing_completion.entitlement_awarded,
      case
        when v_existing_completion.entitlement_awarded then 'You earned your raffle entry.'
        else 'You already earned your raffle entry. This retake does not create another ticket.'
      end;

    return;
  end if;

  select *
  into v_entitlement
  from public.raffle_entitlements
  where event_id = p_event_id
    and client_session_id = p_client_session_id;

  if found then
    v_entitlement_status := 'existing';
  else
    v_entitlement_status := 'new';

    insert into public.raffle_entitlements (
      event_id,
      client_session_id,
      verification_code
    )
    values (
      p_event_id,
      p_client_session_id,
      public.generate_neighborly_verification_code()
    )
    returning *
    into v_entitlement;
  end if;

  select coalesce(max(qc.attempt_number), 0) + 1
  into v_attempt_number
  from public.quiz_completions qc
  where qc.event_id = p_event_id
    and qc.client_session_id = p_client_session_id;

  insert into public.quiz_completions (
    event_id,
    client_session_id,
    request_id,
    attempt_number,
    submitted_answers,
    score,
    duration_ms,
    verification_code,
    entitlement_awarded,
    entitlement_id
  )
  values (
    p_event_id,
    p_client_session_id,
    p_request_id,
    v_attempt_number,
    p_submitted_answers,
    p_score,
    p_duration_ms,
    v_entitlement.verification_code,
    v_entitlement_status = 'new',
    v_entitlement.id
  )
  returning *
  into v_completion;

  if v_entitlement.first_completion_id is null then
    update public.raffle_entitlements
    set first_completion_id = v_completion.id
    where id = v_entitlement.id
    returning *
    into v_entitlement;
  end if;

  return query
  select
    v_completion.id,
    v_completion.attempt_number,
    v_completion.score,
    v_entitlement_status,
    v_entitlement.verification_code,
    v_entitlement.created_at,
    v_entitlement_status = 'new',
    case
      when v_entitlement_status = 'new' then 'You earned your raffle entry.'
      else 'You already earned your raffle entry. This retake does not create another ticket.'
    end;
end;
$$;
