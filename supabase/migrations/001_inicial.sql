create table public.decks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  source_type text not null check (source_type in ('text', 'url')),
  source_url  text check (source_url is null or (char_length(source_url) <= 2000 and source_url ~ '^https?://')),
  key_points  text[] not null default '{}'
              check (cardinality(key_points) <= 20 and char_length(array_to_string(key_points, '')) <= 12000),
  created_at  timestamptz not null default now()
);
create index decks_user_created_idx on public.decks (user_id, created_at desc);

create table public.cards (
  id            uuid primary key default gen_random_uuid(),
  deck_id       uuid not null references public.decks (id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  question      text not null check (char_length(question) between 1 and 500),
  answer        text not null check (char_length(answer) between 1 and 1000),
  ease          real not null default 2.5 check (ease between 1.3 and 10),
  interval_days integer not null default 0 check (interval_days between 0 and 36500),
  repetitions   integer not null default 0 check (repetitions >= 0),
  lapses        integer not null default 0 check (lapses >= 0),
  due           timestamptz not null default now(),
  last_reviewed timestamptz
);
create index cards_user_due_idx on public.cards (user_id, due);
create index cards_deck_idx on public.cards (deck_id);

alter table public.decks enable row level security;
alter table public.cards enable row level security;

create policy "decks: dono lê"   on public.decks for select to authenticated using ((select auth.uid()) = user_id);
create policy "decks: dono apaga" on public.decks for delete to authenticated using ((select auth.uid()) = user_id);

create policy "cards: dono lê" on public.cards for select to authenticated using ((select auth.uid()) = user_id);
create policy "cards: dono atualiza" on public.cards for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.decks, public.cards from anon, authenticated;
grant select, delete on public.decks to authenticated;
grant select on public.cards to authenticated;
grant update (ease, interval_days, repetitions, lapses, due, last_reviewed) on public.cards to authenticated;
grant select, insert, delete on public.decks, public.cards to service_role;

create or replace function public.create_deck(
  p_user uuid, p_title text, p_source_type text, p_source_url text, p_key_points text[], p_cards jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deck uuid;
begin
  if p_user is null then
    raise exception 'usuário obrigatório';
  end if;
  if jsonb_typeof(p_cards) <> 'array' or jsonb_array_length(p_cards) not between 1 and 40 then
    raise exception 'lista de cartões inválida';
  end if;
  if (select count(*) from public.decks where user_id = p_user) >= 1000 then
    raise exception 'limite de materiais atingido';
  end if;

  insert into public.decks (user_id, title, source_type, source_url, key_points)
  values (p_user, p_title, p_source_type, p_source_url, p_key_points)
  returning id into v_deck;

  insert into public.cards (deck_id, user_id, question, answer)
  select v_deck, p_user, c ->> 'question', c ->> 'answer'
  from jsonb_array_elements(p_cards) as c;

  return v_deck;
end;
$$;
revoke execute on function public.create_deck(uuid, text, text, text, text[], jsonb) from public, anon, authenticated;
grant execute on function public.create_deck(uuid, text, text, text, text[], jsonb) to service_role;

create table public.generations (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index generations_created_idx on public.generations (created_at);
create index generations_user_created_idx on public.generations (user_id, created_at desc);
alter table public.generations enable row level security;
revoke all on public.generations from anon, authenticated;
grant select, insert, delete on public.generations to service_role;

create or replace function public.consume_generation(
  p_user uuid, p_per_10min int, p_per_day int, p_global_per_day int
) returns table (generation_id bigint, reason text, retry_after_sec int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_global int;
  v_short  int;
  v_day    int;
  v_oldest timestamptz;
  v_id     bigint;
begin
  perform pg_advisory_xact_lock(hashtext('generations'));

  select count(*), min(created_at) into v_global, v_oldest
  from public.generations where created_at > now() - interval '24 hours';
  if v_global >= p_global_per_day then
    return query select null::bigint, 'global'::text,
      greatest(1, ceil(extract(epoch from v_oldest + interval '24 hours' - now())))::int;
    return;
  end if;

  select count(*) filter (where created_at > now() - interval '10 minutes'), count(*)
  into v_short, v_day
  from public.generations where user_id = p_user and created_at > now() - interval '24 hours';

  if v_short >= p_per_10min then
    select min(created_at) into v_oldest from public.generations
    where user_id = p_user and created_at > now() - interval '10 minutes';
    return query select null::bigint, 'short'::text,
      greatest(1, ceil(extract(epoch from v_oldest + interval '10 minutes' - now())))::int;
    return;
  end if;

  if v_day >= p_per_day then
    select min(created_at) into v_oldest from public.generations
    where user_id = p_user and created_at > now() - interval '24 hours';
    return query select null::bigint, 'daily'::text,
      greatest(1, ceil(extract(epoch from v_oldest + interval '24 hours' - now())))::int;
    return;
  end if;

  insert into public.generations (user_id) values (p_user) returning id into v_id;
  return query select v_id, 'ok'::text, 0;
end;
$$;

create or replace function public.refund_generation(p_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.generations where id = p_id;
$$;

create table public.rate_events (
  id         bigint generated always as identity primary key,
  key        text not null check (char_length(key) <= 100),
  created_at timestamptz not null default now()
);
create index rate_events_key_created_idx on public.rate_events (key, created_at desc);
alter table public.rate_events enable row level security;
revoke all on public.rate_events from anon, authenticated;
grant select, insert, delete on public.rate_events to service_role;

create or replace function public.take_rate_token(p_key text, p_window_seconds int, p_max int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count  int;
  v_oldest timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext(p_key));
  if random() < 0.01 then
    delete from public.rate_events where created_at < now() - interval '1 day';
  end if;

  select count(*), min(created_at) into v_count, v_oldest
  from public.rate_events
  where key = p_key and created_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_max then
    return greatest(1, ceil(extract(epoch from v_oldest + make_interval(secs => p_window_seconds) - now())))::int;
  end if;

  insert into public.rate_events (key) values (p_key);
  return 0;
end;
$$;
revoke execute on function public.take_rate_token(text, int, int) from public, anon, authenticated;
grant execute on function public.take_rate_token(text, int, int) to service_role;

revoke execute on function public.consume_generation(uuid, int, int, int) from public, anon, authenticated;
revoke execute on function public.refund_generation(bigint) from public, anon, authenticated;
grant execute on function public.consume_generation(uuid, int, int, int) to service_role;
grant execute on function public.refund_generation(bigint) to service_role;
