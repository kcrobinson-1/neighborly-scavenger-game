create or replace function public.generate_neighborly_verification_code()
returns text
language plpgsql
set search_path = public
as $$
begin
  return 'MMP-' || upper(
    substring(encode(extensions.gen_random_bytes(4), 'hex') from 1 for 8)
  );
end;
$$;
