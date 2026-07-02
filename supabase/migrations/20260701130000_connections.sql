-- Accountability circle: let users share TODAY's hydration summary with a
-- partner/family/friend so they keep each other accountable. This is Hydro AI's
-- first cross-user surface, so the privacy model is strict:
--   * summary only — a connection exposes today's total/goal/streak, NEVER
--     individual log_entries rows or thumbnails;
--   * that summary crosses the boundary ONLY through SECURITY DEFINER RPCs
--     (same pattern as consume_ai_quota) — clients cannot read another user's
--     log_entries or profiles directly (their per-user RLS is untouched).
-- Connections are symmetric: one accepted row = both sides see each other.

-- ── Tables ──────────────────────────────────────────────────────────────────

-- One row per relationship, stored as an ordered pair (user_a < user_b) so a
-- pair is unique regardless of who initiated. `status` is 'accepted' in v1;
-- the column is kept for a future request/approve flow.
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  status text not null default 'accepted',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint connections_ordered check (user_a < user_b),
  unique (user_a, user_b)
);

-- Shareable invite codes. Whoever holds a code may connect (they were given it
-- → implicit consent). Reused while active; single-use once claimed.
create table public.connection_invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz
);

create index connection_invites_inviter_idx on public.connection_invites (inviter_id);

alter table public.connections enable row level security;
alter table public.connection_invites enable row level security;

-- Direct-table reads are limited to rows referencing the caller; all mutation
-- and all cross-user summary reads go through the RPCs below (SECURITY DEFINER,
-- so they run as owner and intentionally bypass RLS).
create policy "connections_select_own" on public.connections
  for select using (auth.uid() in (user_a, user_b));

create policy "connection_invites_select_own" on public.connection_invites
  for select using (auth.uid() = inviter_id);

-- ── Streak helper ─────────────────────────────────────────────────────────────

-- Consecutive goal-met days for a partner, ending "today", matching the app's
-- computeStreaks rule (an unmet today is in-progress — it neither counts nor
-- breaks the run). Day windows are caller-supplied (p_day_start = local
-- midnight) and stepped back one day at a time, so "today" and the streak share
-- the same day grid as the viewer's app. Not granted to clients — only the
-- SECURITY DEFINER RPCs below call it (as owner).
create or replace function public._hydro_partner_streak(
  p_partner uuid,
  p_day_start timestamptz,
  p_goal int,
  p_lookback int
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_streak int := 0;
  v_i int;
  v_start timestamptz;
  v_total int;
begin
  if p_goal <= 0 then
    return 0;
  end if;
  for v_i in 0..p_lookback loop
    v_start := p_day_start - (v_i || ' days')::interval;
    select coalesce(sum(le.effective_hydration_ml), 0) into v_total
      from public.log_entries le
      where le.user_id = p_partner
        and le.logged_at >= v_start
        and le.logged_at < v_start + interval '1 day';
    if v_i = 0 and v_total < p_goal then
      continue; -- today still in progress; skip without breaking the streak
    end if;
    if v_total >= p_goal then
      v_streak := v_streak + 1;
    else
      exit;
    end if;
  end loop;
  return v_streak;
end;
$$;

revoke execute on function public._hydro_partner_streak(uuid, timestamptz, int, int) from public, anon, authenticated;

-- ── RPCs ──────────────────────────────────────────────────────────────────────

-- Mint (or reuse) an active invite for the caller. Codes use an unambiguous
-- alphabet (no I/L/O/0/1) so they're safe to read aloud or type.
create or replace function public.create_connection_invite()
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_i int;
  v_existing record;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select ci.code, ci.expires_at into v_existing
    from public.connection_invites ci
    where ci.inviter_id = v_uid and ci.claimed_by is null and ci.expires_at > now()
    order by ci.created_at desc
    limit 1;
  if found then
    code := v_existing.code;
    expires_at := v_existing.expires_at;
    return next;
    return;
  end if;

  loop
    v_code := '';
    for v_i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.connection_invites ci where ci.code = v_code);
  end loop;

  insert into public.connection_invites (code, inviter_id)
    values (v_code, v_uid)
    returning connection_invites.expires_at into expires_at;
  code := v_code;
  return next;
end;
$$;

-- Redeem a code → create the (symmetric) connection and return the inviter's
-- summary for the success screen. Raises distinct messages the client maps to a
-- friendly Alert. Day bounds are the viewer's local day (for today's numbers).
create or replace function public.claim_connection_invite(
  p_code text,
  p_day_start timestamptz,
  p_day_end timestamptz,
  p_lookback int default 60
)
returns table (
  connection_id uuid,
  partner_id uuid,
  display_name text,
  avatar_url text,
  total_intake_ml int,
  goal_ml int,
  goal_met boolean,
  streak int
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.connection_invites%rowtype;
  v_a uuid;
  v_b uuid;
  v_conn_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_inv from public.connection_invites ci where ci.code = upper(trim(p_code));
  if not found then
    raise exception 'invite_not_found';
  end if;
  if v_inv.inviter_id = v_uid then
    raise exception 'invite_self';
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'invite_expired';
  end if;
  if v_inv.claimed_by is not null then
    raise exception 'invite_already_claimed';
  end if;

  v_a := least(v_uid, v_inv.inviter_id);
  v_b := greatest(v_uid, v_inv.inviter_id);
  if exists (select 1 from public.connections c where c.user_a = v_a and c.user_b = v_b) then
    raise exception 'already_connected';
  end if;

  insert into public.connections (user_a, user_b, status, created_by)
    values (v_a, v_b, 'accepted', v_uid)
    returning id into v_conn_id;

  update public.connection_invites
    set claimed_by = v_uid, claimed_at = now()
    where id = v_inv.id;

  connection_id := v_conn_id;
  partner_id := v_inv.inviter_id;
  select p.display_name, p.avatar_url, p.daily_goal_ml
    into display_name, avatar_url, goal_ml
    from public.profiles p where p.id = v_inv.inviter_id;
  select coalesce(sum(le.effective_hydration_ml), 0) into total_intake_ml
    from public.log_entries le
    where le.user_id = v_inv.inviter_id
      and le.logged_at >= p_day_start and le.logged_at < p_day_end;
  goal_met := coalesce(goal_ml, 0) > 0 and total_intake_ml >= goal_ml;
  streak := public._hydro_partner_streak(v_inv.inviter_id, p_day_start, coalesce(goal_ml, 2000), p_lookback);
  return next;
end;
$$;

-- Every accepted connection for the caller, each as a summary-only overview.
-- p_day_start/p_day_end are the viewer's local calendar day.
create or replace function public.get_connections_overview(
  p_day_start timestamptz,
  p_day_end timestamptz,
  p_lookback int default 60
)
returns table (
  connection_id uuid,
  partner_id uuid,
  display_name text,
  avatar_url text,
  total_intake_ml int,
  goal_ml int,
  goal_met boolean,
  streak int
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  r record;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  for r in
    select c.id as conn_id,
           case when c.user_a = v_uid then c.user_b else c.user_a end as partner
    from public.connections c
    where c.status = 'accepted' and v_uid in (c.user_a, c.user_b)
  loop
    connection_id := r.conn_id;
    partner_id := r.partner;
    select p.display_name, p.avatar_url, p.daily_goal_ml
      into display_name, avatar_url, goal_ml
      from public.profiles p where p.id = r.partner;
    select coalesce(sum(le.effective_hydration_ml), 0) into total_intake_ml
      from public.log_entries le
      where le.user_id = r.partner
        and le.logged_at >= p_day_start and le.logged_at < p_day_end;
    goal_met := coalesce(goal_ml, 0) > 0 and total_intake_ml >= goal_ml;
    streak := public._hydro_partner_streak(r.partner, p_day_start, coalesce(goal_ml, 2000), p_lookback);
    return next;
  end loop;
end;
$$;

-- Drop a connection. Either member may remove it.
create or replace function public.remove_connection(p_connection_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  delete from public.connections
    where id = p_connection_id and v_uid in (user_a, user_b);
end;
$$;

-- Callable only by signed-in users.
revoke execute on function public.create_connection_invite() from public, anon;
grant execute on function public.create_connection_invite() to authenticated;
revoke execute on function public.claim_connection_invite(text, timestamptz, timestamptz, int) from public, anon;
grant execute on function public.claim_connection_invite(text, timestamptz, timestamptz, int) to authenticated;
revoke execute on function public.get_connections_overview(timestamptz, timestamptz, int) from public, anon;
grant execute on function public.get_connections_overview(timestamptz, timestamptz, int) to authenticated;
revoke execute on function public.remove_connection(uuid) from public, anon;
grant execute on function public.remove_connection(uuid) to authenticated;
