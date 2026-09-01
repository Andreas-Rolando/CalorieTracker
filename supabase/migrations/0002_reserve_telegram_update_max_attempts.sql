-- Bounds retries on a single Telegram update_id.
--
-- Previously a permanently-failing update (e.g. a deterministic Gemini
-- error) would be retried by Telegram forever, re-running expensive work
-- (Gemini calls) on every retry and burning through free-tier API quota.
-- Once attempt_count reaches p_max_attempts, `reserve_telegram_update`
-- returns 'abandon' instead of reclaiming the update, so the webhook can
-- give up and stop Telegram's retry loop (see app/api/telegram/webhook).

create or replace function reserve_telegram_update(
  p_update_id bigint,
  p_stale_seconds int default 60,
  p_max_attempts int default 5
)
returns table (action text) as $$
declare
  v_status text;
  v_locked_at timestamptz;
  v_attempt_count int;
begin
  insert into telegram_updates (update_id, status, attempt_count, locked_at)
  values (p_update_id, 'processing', 1, now())
  on conflict (update_id) do nothing;

  if found then
    return query select 'process'::text;
    return;
  end if;

  select status, locked_at, attempt_count into v_status, v_locked_at, v_attempt_count
  from telegram_updates
  where update_id = p_update_id
  for update;

  if v_status = 'processed' then
    return query select 'skip'::text;
  elsif v_status = 'processing' and v_locked_at > now() - make_interval(secs => p_stale_seconds) then
    return query select 'skip'::text;
  elsif v_attempt_count >= p_max_attempts then
    -- Already failed (or stuck) p_max_attempts times — give up rather than
    -- reclaim again. Row is left as-is for the audit trail (last_error
    -- still shows why it failed).
    return query select 'abandon'::text;
  else
    update telegram_updates
    set status = 'processing',
        attempt_count = attempt_count + 1,
        locked_at = now()
    where update_id = p_update_id;

    return query select 'process'::text;
  end if;
end;
$$ language plpgsql;
