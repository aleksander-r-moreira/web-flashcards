alter table public.decks drop constraint decks_source_type_check;
alter table public.decks add constraint decks_source_type_check
  check (source_type in ('text', 'url', 'video'));

alter table public.decks add constraint decks_video_url_check
  check (source_type <> 'video' or source_url ~ '^https://www\.youtube\.com/watch\?v=[A-Za-z0-9_-]{11}$');

alter table public.generations
  add column kind text not null default 'text' check (kind in ('text', 'video'));
create index generations_kind_created_idx on public.generations (kind, created_at);

drop function public.consume_generation(uuid, int, int, int);

create or replace function public.consume_generation(
  p_user uuid, p_kind text,
  p_per_10min int, p_per_day int, p_global_per_day int,
  p_video_per_day int, p_video_global_per_day int
) returns table (generation_id bigint, reason text, retry_after_sec int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count  int;
  v_short  int;
  v_oldest timestamptz;
  v_id     bigint;
begin
  if p_kind not in ('text', 'video') then
    raise exception 'tipo inválido';
  end if;
  perform pg_advisory_xact_lock(hashtext('generations'));

  select count(*), min(created_at) into v_count, v_oldest
  from public.generations where created_at > now() - interval '24 hours';
  if v_count >= p_global_per_day then
    return query select null::bigint, 'global'::text,
      greatest(1, ceil(extract(epoch from v_oldest + interval '24 hours' - now())))::int;
    return;
  end if;

  if p_kind = 'video' then
    select count(*), min(created_at) into v_count, v_oldest
    from public.generations where kind = 'video' and created_at > now() - interval '24 hours';
    if v_count >= p_video_global_per_day then
      return query select null::bigint, 'video_global'::text,
        greatest(1, ceil(extract(epoch from v_oldest + interval '24 hours' - now())))::int;
      return;
    end if;
    select count(*), min(created_at) into v_count, v_oldest
    from public.generations where user_id = p_user and kind = 'video' and created_at > now() - interval '24 hours';
    if v_count >= p_video_per_day then
      return query select null::bigint, 'video_daily'::text,
        greatest(1, ceil(extract(epoch from v_oldest + interval '24 hours' - now())))::int;
      return;
    end if;
  end if;

  select count(*) filter (where created_at > now() - interval '10 minutes'), count(*)
  into v_short, v_count
  from public.generations where user_id = p_user and created_at > now() - interval '24 hours';

  if v_short >= p_per_10min then
    select min(created_at) into v_oldest from public.generations
    where user_id = p_user and created_at > now() - interval '10 minutes';
    return query select null::bigint, 'short'::text,
      greatest(1, ceil(extract(epoch from v_oldest + interval '10 minutes' - now())))::int;
    return;
  end if;
  if v_count >= p_per_day then
    select min(created_at) into v_oldest from public.generations
    where user_id = p_user and created_at > now() - interval '24 hours';
    return query select null::bigint, 'daily'::text,
      greatest(1, ceil(extract(epoch from v_oldest + interval '24 hours' - now())))::int;
    return;
  end if;

  insert into public.generations (user_id, kind) values (p_user, p_kind) returning id into v_id;
  return query select v_id, 'ok'::text, 0;
end;
$$;

revoke execute on function public.consume_generation(uuid, text, int, int, int, int, int) from public, anon, authenticated;
grant execute on function public.consume_generation(uuid, text, int, int, int, int, int) to service_role;
