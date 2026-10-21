create or replace function public.release_rate_token(p_key text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.rate_events
  where id = (
    select id from public.rate_events
    where key = p_key
    order by created_at desc
    limit 1
  );
$$;

revoke execute on function public.release_rate_token(text) from public, anon, authenticated;
grant execute on function public.release_rate_token(text) to service_role;
