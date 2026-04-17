-- Authoring access-control primitives.
-- Defines the admin allowlist table plus helper SQL functions used by RLS and
-- edge-function auth checks for draft and version access.
create table if not exists public.quiz_admin_users (
  email text primary key,
  user_id uuid unique references auth.users (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quiz_admin_users_email_normalized
    check (email = lower(btrim(email)) and email <> '')
);

alter table public.quiz_admin_users enable row level security;

revoke all on table public.quiz_admin_users
  from anon, authenticated;

grant select, insert, update, delete on table public.quiz_admin_users
  to service_role;

-- Reads normalized email from JWT claims; returns null when claims are absent
-- or malformed.
create or replace function public.current_request_email()
returns text
language sql
stable
as $$
  with claims as (
    select nullif(current_setting('request.jwt.claims', true), '') as raw_claims
  )
  select case
    when claims.raw_claims is null then null
    else nullif(lower(btrim(claims.raw_claims::jsonb ->> 'email')), '')
  end
  from claims;
$$;

-- Reads caller user id from JWT claims and rejects non-UUID `sub` values.
create or replace function public.current_request_user_id()
returns uuid
language sql
stable
as $$
  with claims as (
    select nullif(current_setting('request.jwt.claims', true), '') as raw_claims
  )
  select case
    when claims.raw_claims is null then null
    when (claims.raw_claims::jsonb ->> 'sub')
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (claims.raw_claims::jsonb ->> 'sub')::uuid
    else null
  end
  from claims;
$$;

-- Security-definer helper used by RLS policies and authenticated function
-- callers to test active allowlist membership.
create or replace function public.is_quiz_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.quiz_admin_users as admin_user
    where admin_user.active
      and (
        admin_user.email = public.current_request_email()
        or (
          admin_user.user_id is not null
          and admin_user.user_id = public.current_request_user_id()
        )
      )
  );
$$;

revoke all on function public.is_quiz_admin() from public;
grant execute on function public.is_quiz_admin() to anon, authenticated, service_role;

grant select, insert, update, delete on table public.quiz_event_drafts
  to authenticated;

grant select on table public.quiz_event_versions
  to authenticated;

create policy "quiz admins can read drafts"
on public.quiz_event_drafts
for select
to authenticated
using (public.is_quiz_admin());

create policy "quiz admins can insert drafts"
on public.quiz_event_drafts
for insert
to authenticated
with check (public.is_quiz_admin());

create policy "quiz admins can update drafts"
on public.quiz_event_drafts
for update
to authenticated
using (public.is_quiz_admin())
with check (public.is_quiz_admin());

create policy "quiz admins can delete drafts"
on public.quiz_event_drafts
for delete
to authenticated
using (public.is_quiz_admin());

create policy "quiz admins can read versions"
on public.quiz_event_versions
for select
to authenticated
using (public.is_quiz_admin());

create or replace function public.set_quiz_event_draft_audit_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_request_user_id uuid;
begin
  new.updated_at = now();
  v_request_user_id = public.current_request_user_id();

  if v_request_user_id is not null then
    new.last_saved_by = v_request_user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists set_quiz_event_draft_audit_fields
on public.quiz_event_drafts;

create trigger set_quiz_event_draft_audit_fields
before insert or update on public.quiz_event_drafts
for each row
execute function public.set_quiz_event_draft_audit_fields();
