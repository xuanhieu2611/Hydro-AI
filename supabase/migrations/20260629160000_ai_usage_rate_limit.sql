-- ai_usage: per-user AI request counters backing the analyze-image rate limit
-- (cost guardrail — IMPLEMENTATION_PLAN §Phase 5). One row per user holds a
-- per-minute burst window and a per-day window; the SECURITY DEFINER RPC
-- consume_ai_quota() is the ONLY writer (no insert/update/delete policies).
create table public.ai_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  minute_window_start timestamptz not null default now(),
  minute_count int not null default 0,
  day_window_start timestamptz not null default now(),
  day_count int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.ai_usage enable row level security;

-- Users may read their own usage (e.g. an "N analyses left today" UI later).
-- Writes go exclusively through consume_ai_quota(), so there is no write policy.
create policy "ai_usage_select_own" on public.ai_usage
  for select using (auth.uid() = user_id);

-- Atomically charge the caller one AI request against both windows.
-- Returns whether the request is allowed and, when blocked, which limit tripped
-- plus how long to wait. Fixed-window counters: each window resets the first
-- time it is touched after it has elapsed.
create or replace function public.consume_ai_quota(
  p_minute_limit int default 10,
  p_day_limit int default 100
)
returns table (
  allowed boolean,
  limit_kind text,
  retry_after_seconds int,
  minute_remaining int,
  day_remaining int
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_row public.ai_usage%rowtype;
begin
  if v_uid is null then
    raise exception 'consume_ai_quota: no authenticated user';
  end if;

  -- Create the counter row on first use, then lock it for this transaction so
  -- concurrent calls from the same user can't both slip past the cap.
  insert into public.ai_usage (user_id, minute_window_start, day_window_start)
    values (v_uid, v_now, v_now)
    on conflict (user_id) do nothing;

  select * into v_row from public.ai_usage where user_id = v_uid for update;

  -- Roll each window forward if it has elapsed.
  if v_now - v_row.minute_window_start >= interval '1 minute' then
    v_row.minute_window_start := v_now;
    v_row.minute_count := 0;
  end if;
  if v_now - v_row.day_window_start >= interval '1 day' then
    v_row.day_window_start := v_now;
    v_row.day_count := 0;
  end if;

  -- Day cap first (the costlier limit to breach), then the per-minute burst.
  if v_row.day_count >= p_day_limit then
    allowed := false;
    limit_kind := 'day';
    retry_after_seconds := ceil(extract(epoch from
      (v_row.day_window_start + interval '1 day' - v_now)))::int;
  elsif v_row.minute_count >= p_minute_limit then
    allowed := false;
    limit_kind := 'minute';
    retry_after_seconds := ceil(extract(epoch from
      (v_row.minute_window_start + interval '1 minute' - v_now)))::int;
  else
    allowed := true;
    limit_kind := null;
    retry_after_seconds := 0;
    v_row.minute_count := v_row.minute_count + 1;
    v_row.day_count := v_row.day_count + 1;
  end if;

  update public.ai_usage set
    minute_window_start = v_row.minute_window_start,
    minute_count = v_row.minute_count,
    day_window_start = v_row.day_window_start,
    day_count = v_row.day_count,
    updated_at = v_now
  where user_id = v_uid;

  minute_remaining := greatest(p_minute_limit - v_row.minute_count, 0);
  day_remaining := greatest(p_day_limit - v_row.day_count, 0);
  return next;
end;
$$;

-- Callable only by signed-in users (anonymous sign-in still has this role).
revoke execute on function public.consume_ai_quota(int, int) from public, anon;
grant execute on function public.consume_ai_quota(int, int) to authenticated;
