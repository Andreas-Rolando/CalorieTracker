-- CalorieTracker AI Bot & Health Dashboard v5.2 Personal
-- Initial schema. Apply with `supabase db push` or by running this file
-- against the project's Postgres database (SQL editor / psql).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- shared helpers
-- ---------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------

create table users (
  telegram_id bigint primary key,

  name text not null,
  bot_alias text not null,

  gender text not null check (gender in ('male', 'female')),
  age int not null check (age > 0 and age < 130),
  height_cm numeric not null check (height_cm > 0),
  weight_kg numeric not null check (weight_kg > 0),
  target_weight_kg numeric not null check (target_weight_kg > 0),
  goal text not null check (goal in ('lose', 'maintain', 'gain')),
  activity_level text not null check (
    activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')
  ),

  bmr numeric not null,
  tdee numeric not null,

  daily_calorie_target numeric not null,
  protein_target_g numeric not null,
  carbs_target_g numeric not null,
  fat_target_g numeric not null,
  water_target_ml numeric not null,

  timezone text not null default 'Asia/Jakarta',

  dashboard_token text not null unique,
  dashboard_enabled boolean not null default true,

  onboarding_completed boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger users_set_updated_at
  before update on users
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- bot_sessions: persistent onboarding / conversation state
-- ---------------------------------------------------------------------

create table bot_sessions (
  telegram_id bigint primary key,
  flow text not null,
  step text not null,
  state_json jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger bot_sessions_set_updated_at
  before update on bot_sessions
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- meal_drafts: persistent pending meal (preview / portion correction)
-- ---------------------------------------------------------------------

create table meal_drafts (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references users (telegram_id) on delete cascade,

  source text not null check (source in ('text', 'photo', 'voice', 'barcode')),
  meal_type text,

  base_nutrition_json jsonb not null,
  portion_multiplier numeric not null default 1.0,

  status text not null default 'pending' check (
    status in ('pending', 'saved', 'cancelled', 'expired')
  ),

  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meal_drafts_telegram_id_status_idx
  on meal_drafts (telegram_id, status);

create trigger meal_drafts_set_updated_at
  before update on meal_drafts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- daily_food_logs
-- ---------------------------------------------------------------------

create table daily_food_logs (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references users (telegram_id) on delete cascade,

  meal_type text,
  food_name text not null,

  calories numeric not null check (calories >= 0),
  protein_g numeric not null check (protein_g >= 0),
  carbs_g numeric not null check (carbs_g >= 0),
  fat_g numeric not null check (fat_g >= 0),

  sugar_g numeric check (sugar_g is null or sugar_g >= 0),
  fiber_g numeric check (fiber_g is null or fiber_g >= 0),
  sodium_mg numeric check (sodium_mg is null or sodium_mg >= 0),

  nutrition_score numeric,
  nutrition_score_version text,

  estimated_portion_g numeric,
  portion_multiplier numeric not null default 1.0,

  source text not null check (source in ('text', 'photo', 'voice', 'barcode', 'manual')),
  ai_confidence numeric check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)),

  consumed_at timestamptz not null default now(),
  local_date date not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index daily_food_logs_telegram_id_local_date_idx
  on daily_food_logs (telegram_id, local_date)
  where deleted_at is null;

create trigger daily_food_logs_set_updated_at
  before update on daily_food_logs
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- weight_logs / water_logs / exercise_logs
-- ---------------------------------------------------------------------

create table weight_logs (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references users (telegram_id) on delete cascade,
  weight_kg numeric not null check (weight_kg > 0),
  measured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index weight_logs_telegram_id_measured_at_idx
  on weight_logs (telegram_id, measured_at);

create table water_logs (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references users (telegram_id) on delete cascade,
  amount_ml numeric not null check (amount_ml > 0),
  consumed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index water_logs_telegram_id_consumed_at_idx
  on water_logs (telegram_id, consumed_at);

create table exercise_logs (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references users (telegram_id) on delete cascade,
  activity_name text not null,
  duration_minutes numeric not null check (duration_minutes > 0),
  met_value numeric not null check (met_value > 0),
  calories_burned numeric not null check (calories_burned >= 0),
  performed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index exercise_logs_telegram_id_performed_at_idx
  on exercise_logs (telegram_id, performed_at);

-- ---------------------------------------------------------------------
-- nutrition_target_history
-- ---------------------------------------------------------------------

create table nutrition_target_history (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references users (telegram_id) on delete cascade,

  weight_kg numeric not null,
  bmr numeric not null,
  tdee numeric not null,
  calorie_target numeric not null,
  protein_target_g numeric not null,
  carbs_target_g numeric not null,
  fat_target_g numeric not null,
  water_target_ml numeric not null,

  effective_from timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index nutrition_target_history_telegram_id_effective_from_idx
  on nutrition_target_history (telegram_id, effective_from);

-- ---------------------------------------------------------------------
-- reminder scheduling
-- ---------------------------------------------------------------------

create table user_schedules (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references users (telegram_id) on delete cascade,

  label text not null,
  scheduled_time time not null,
  timezone text not null,
  is_active boolean not null default true,
  next_run_at timestamptz not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index user_schedules_due_idx
  on user_schedules (next_run_at)
  where is_active = true;

create trigger user_schedules_set_updated_at
  before update on user_schedules
  for each row execute function set_updated_at();

create table workout_schedules (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references users (telegram_id) on delete cascade,

  label text not null,
  scheduled_time time not null,
  timezone text not null,
  is_active boolean not null default true,
  next_run_at timestamptz not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workout_schedules_due_idx
  on workout_schedules (next_run_at)
  where is_active = true;

create trigger workout_schedules_set_updated_at
  before update on workout_schedules
  for each row execute function set_updated_at();

create table notification_logs (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references users (telegram_id) on delete cascade,

  schedule_type text not null check (schedule_type in ('meal', 'workout')),
  schedule_id uuid not null,
  occurrence_date date not null,

  sent_at timestamptz not null default now(),

  unique (schedule_type, schedule_id, occurrence_date)
);

-- ---------------------------------------------------------------------
-- telegram_updates: webhook idempotency / recovery
-- ---------------------------------------------------------------------

create table telegram_updates (
  update_id bigint primary key,
  status text not null default 'processing' check (
    status in ('processing', 'processed', 'failed')
  ),
  attempt_count int not null default 1,
  locked_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger telegram_updates_set_updated_at
  before update on telegram_updates
  for each row execute function set_updated_at();

-- Atomically reserve an update_id for processing.
--
-- Returns 'process' when the caller should handle the update (new update,
-- previously failed update, or a processing lock that went stale because a
-- prior attempt crashed), and 'skip' when the update is already processed
-- or is currently being processed by a fresh (non-stale) lock.
create or replace function reserve_telegram_update(
  p_update_id bigint,
  p_stale_seconds int default 60
)
returns table (action text) as $$
declare
  v_status text;
  v_locked_at timestamptz;
begin
  insert into telegram_updates (update_id, status, attempt_count, locked_at)
  values (p_update_id, 'processing', 1, now())
  on conflict (update_id) do nothing;

  if found then
    return query select 'process'::text;
    return;
  end if;

  select status, locked_at into v_status, v_locked_at
  from telegram_updates
  where update_id = p_update_id
  for update;

  if v_status = 'processed' then
    return query select 'skip'::text;
  elsif v_status = 'processing' and v_locked_at > now() - make_interval(secs => p_stale_seconds) then
    return query select 'skip'::text;
  else
    -- status = 'failed', or a stale 'processing' lock: reclaim it.
    update telegram_updates
    set status = 'processing',
        attempt_count = attempt_count + 1,
        locked_at = now()
    where update_id = p_update_id;

    return query select 'process'::text;
  end if;
end;
$$ language plpgsql;
