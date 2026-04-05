create index if not exists quiz_completions_entitlement_id_idx
  on public.quiz_completions (entitlement_id);

create index if not exists raffle_entitlements_first_completion_id_idx
  on public.raffle_entitlements (first_completion_id);

alter function public.generate_neighborly_verification_code()
  set search_path = public;

revoke all on table public.quiz_completions
  from anon, authenticated;

revoke all on table public.raffle_entitlements
  from anon, authenticated;

revoke execute on function public.complete_quiz_and_award_entitlement(
  text,
  text,
  text,
  jsonb,
  integer,
  integer
)
from public, anon, authenticated;

revoke execute on function public.generate_neighborly_verification_code()
from public, anon, authenticated;

grant execute on function public.complete_quiz_and_award_entitlement(
  text,
  text,
  text,
  jsonb,
  integer,
  integer
)
to service_role;

grant execute on function public.generate_neighborly_verification_code()
to service_role;
