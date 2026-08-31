# Product Requirements Document (PRD)
# CalorieTracker AI Bot & Health Dashboard

**Version:** 5.2 Personal  
**Status:** Implementation Baseline  
**Scope:** Personal / non-commercial use  
**Primary Interface:** Telegram Bot  
**Secondary Interface:** Read-Only Web Dashboard  
**Target Cost:** $0/month where free-tier limits allow

---

# 1. Product Overview

CalorieTracker AI adalah Telegram fitness buddy pribadi untuk membantu user:

- mencatat makanan,
- mengestimasi kalori dan makronutrisi,
- memantau berat badan,
- mencatat air minum,
- mencatat workout,
- menerima reminder,
- melihat progress melalui dashboard web.

Bot harus terasa:

- ramah,
- suportif,
- ringkas,
- personal,
- tidak menghakimi,
- tidak bersikap seperti layanan medis.

Project ini diprioritaskan untuk penggunaan pribadi, bukan platform SaaS atau produk komersial.

---

# 2. Core Product Goals

1. Membuat meal logging semudah mengirim chat Telegram.
2. Mendukung meal logging melalui teks dan foto sebagai fitur utama.
3. Mendukung koreksi porsi sebelum data disimpan.
4. Menghitung BMR, TDEE, calorie target, dan macro target secara deterministic.
5. Memantau perubahan berat badan.
6. Memberikan daily summary yang jelas.
7. Menyediakan dashboard progress sederhana.
8. Memberikan reminder makan dan workout.
9. Menjaga implementasi sesederhana mungkin dan cocok untuk free tier.

---

# 3. Scope Priority

## Essential MVP

- Telegram bot menggunakan grammY
- Telegram ID allowlist
- onboarding/profile
- custom `name`
- custom `bot_alias`
- BMR/TDEE/calorie target
- text meal logging
- photo meal logging
- Gemini structured output
- runtime schema validation
- portion adjustment ±25%
- manual correction
- persistent meal draft
- `/hariini`
- `/bb`
- weight history
- nutrition target history
- read-only dashboard
- reminder makan/workout
- webhook idempotency
- basic water logging
- basic workout logging

## Optional After MVP

- voice meal logging
- barcode / Open Food Facts
- streak
- weekly AI report
- favorite meals
- meal templates
- CSV export
- Telegram Mini App barcode scanner

## Not Required for Personal MVP

- public registration
- subscription/payment
- admin panel
- complex multi-user abuse system
- queue infrastructure
- microservices
- Redis
- Kubernetes
- permanent meal image archive
- complex gamification
- public social features

---

# 4. Mandatory Tech Stack

## Bot
- Telegram Bot API
- grammY
- TypeScript

## Web
- Next.js App Router
- Tailwind CSS
- Recharts

## Backend
- Next.js / Vercel Serverless Functions

## Database
- Supabase PostgreSQL

## AI
- `@google/genai`
- Gemini model from environment
- default: `gemini-2.5-flash`

## Optional External Data
- Open Food Facts API

## Scheduler
- Supabase Cron for frequent reminders
- Vercel Cron for low-frequency maintenance/reporting only

---

# 5. Personal Access Control

Because this project is personal-use, all Telegram updates must be restricted using an allowlist.

Environment:

```env
ALLOWED_TELEGRAM_IDS=123456789
```

Multiple IDs may be comma-separated if needed.

Behavior:

```text
Telegram update
→ read telegram_id
→ allowed?
   ├── no  → ignore/reject safely
   └── yes → process normally
```

This is the primary protection against accidental/public Gemini usage.

---

# 6. Onboarding

Command:

```text
/start
```

Collect:

1. name
2. bot alias
3. gender
4. age
5. height
6. weight
7. target weight
8. activity level
9. goal
10. timezone

After onboarding:

- calculate BMR
- calculate TDEE
- calculate daily calorie target
- calculate macro targets
- calculate water target
- create dashboard token
- create nutrition target history record
- mark onboarding complete

---

# 7. Nutrition Engine

Use deterministic calculations.

## BMR — Mifflin-St Jeor

Male:

```text
10W + 6.25H - 5A + 5
```

Female:

```text
10W + 6.25H - 5A - 161
```

## TDEE

```text
BMR × activity factor
```

## Goal Adjustment

```text
lose     → TDEE - configured deficit
maintain → TDEE
gain     → TDEE + configured surplus
```

Avoid extreme deficit/surplus.

## Macro Targets

Calculated in application code, not by Gemini.

## Nutrition Score

Nutrition score must be deterministic where possible.

Store:

```text
nutrition_score
nutrition_score_version
```

If legacy naming is retained:

```text
who_rating
```

user-facing wording must be:

```text
Skor Gizi X/5 berdasarkan prinsip/pedoman nutrisi WHO
```

Never claim WHO officially rates individual foods 1–5.

---

# 8. Meal Logging

Primary supported input:

- text
- photo

Optional later:

- voice
- barcode

All sources should converge into one normalized meal pipeline.

```text
INPUT
→ NORMALIZE
→ ANALYZE
→ VALIDATE
→ PREVIEW
→ CORRECT
→ SAVE
```

---

# 9. Gemini Meal Analysis

Use:

```text
@google/genai
```

Model:

```env
GEMINI_MODEL=gemini-2.5-flash
```

All AI output must use structured output and runtime validation.

Recommended schema:

```ts
type MealAnalysis = {
  meal_name: string;

  items: Array<{
    name: string;
    estimated_portion_g: number | null;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    sugar_g?: number | null;
    fiber_g?: number | null;
    sodium_mg?: number | null;
  }>;

  totals: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    sugar_g?: number | null;
    fiber_g?: number | null;
    sodium_mg?: number | null;
  };

  confidence: number;
  recommendation: string;
};
```

Use Zod or equivalent validation.

Add business bounds, for example:

```text
confidence: 0..1
calories >= 0
macros >= 0
```

Reject or downgrade clearly absurd values.

AI values are estimates and must be editable by the user.

---

# 10. Photo Meal Logging

For personal MVP, do NOT permanently store meal images by default.

Recommended flow:

```text
Telegram photo
→ download temporarily
→ validate file type/size
→ Gemini Vision
→ structured output
→ preview
→ correct
→ save nutrition data
→ discard temporary image
```

Benefits:

- no Supabase Storage required for meal photos,
- no image cleanup cron,
- lower storage usage,
- simpler privacy model,
- fewer orphan files.

Meal image storage may be added later only if dashboard photo history becomes a real requirement.

---

# 11. Portion Fine-Tuning

Inline keyboard:

```text
[ ➖ 25% ] [ ➕ 25% ]
[ 📝 Edit Manual ]
[ ✅ Simpan ]
```

Use persistent meal drafts.

Do NOT keep pending meal state only in server memory.

Store:

```text
base nutrition
portion_multiplier
status
expires_at
```

Displayed values always equal:

```text
base value × portion multiplier
```

---

# 12. Weight Tracking

Command:

```text
/bb 75
```

Flow:

```text
validate
→ insert weight log
→ update current user weight
→ recalculate nutrition targets
→ insert nutrition target history
→ respond with progress
```

Use separate timestamps:

```text
measured_at
created_at
```

---

# 13. Daily Summary

Command:

```text
/hariini
```

Display:

- calories consumed
- calorie target
- remaining calories
- protein
- carbs
- fat
- water
- workout summary

Do not automatically add exercise calories back into the food allowance.

Show separately:

```text
Food:
1900 / 2000 kcal

Activity:
~350 kcal burned
```

---

# 14. Water Tracking

Example:

```text
/air 500
```

Store amount and event time.

Display daily total against target.

---

# 15. Workout Tracking

Example:

```text
/workout lari 30 menit
```

Prefer deterministic calorie estimation using MET-based formulas.

Example:

```text
kcal/min =
MET × 3.5 × weight_kg / 200
```

Gemini may help interpret free-form activity text, but the calorie calculation should be deterministic.

---

# 16. Reminder System

Support:

- meal reminders
- workout reminders

Do not create one cron job per user.

Use a dispatcher.

Recommended schedule fields:

```text
scheduled_time
timezone
is_active
next_run_at
```

Query only due schedules:

```sql
WHERE is_active = true
AND next_run_at <= NOW()
ORDER BY next_run_at
LIMIT ...
```

After successful send:

- calculate next occurrence
- update `next_run_at`
- create notification log

This avoids scanning every schedule every minute.

---

# 17. Dashboard

Recommended route:

```text
/dashboard/[dashboard_token]
```

Do not use Telegram ID as a public access credential.

Dashboard is read-only.

Show:

- today calories
- calorie target
- current weight
- target weight
- protein progress
- optional workout summary

Charts:

## Calories Bar Chart
Calories vs historical target.

## Weight Line Chart
Weight trend.

## Macro Donut
Protein / carbs / fat.

Dashboard should be mobile-first.

Recommended privacy behavior:

- `noindex`
- avoid long-lived public caching
- allow dashboard token reset later

---

# 18. Historical Nutrition Targets

Do not rely only on:

```text
users.daily_calorie_target
```

because targets may change after `/bb`.

Create:

```text
nutrition_target_history
```

Fields:

```text
id
telegram_id
weight_kg
bmr
tdee
calorie_target
protein_target_g
carbs_target_g
fat_target_g
water_target_ml
effective_from
created_at
```

Dashboard must compare historical intake against the target active at that time.

---

# 19. Event Time vs Created Time

Use event-time fields.

Food:

```text
consumed_at
created_at
```

Weight:

```text
measured_at
created_at
```

Workout:

```text
performed_at
created_at
```

Water:

```text
consumed_at
created_at
```

Default event time may be `now()`.

This keeps the system ready for backdated logging.

All daily grouping must respect the user's timezone.

---

# 20. Streak

Optional after MVP.

If implemented, recommended definition:

```text
Tracking streak:
day counts as active if at least one meal, water, workout, or weight log exists.
```

Workout streak should be separate.

Do not create streak rules that encourage unhealthy calorie restriction.

---

# 21. Webhook Reliability

Telegram updates can be retried.

Use a durable table:

```text
telegram_updates
```

Recommended fields:

```text
update_id
status
attempt_count
locked_at
processed_at
last_error
created_at
updated_at
```

Statuses:

```text
processing
processed
failed
```

Do not permanently skip an update only because its ID was reserved before a crash.

Allow recovery for:

- failed updates,
- stale processing locks.

Use Telegram webhook secret validation when possible.

Environment:

```env
TELEGRAM_WEBHOOK_SECRET=
```

---

# 22. Persistent Conversation State

Vercel Serverless must not rely on in-memory session state.

Create:

```text
bot_sessions
meal_drafts
```

## bot_sessions

Suggested fields:

```text
telegram_id
flow
step
state_json
expires_at
updated_at
```

## meal_drafts

Suggested fields:

```text
id
telegram_id
base_nutrition_json
portion_multiplier
status
expires_at
created_at
updated_at
```

---

# 23. Database Tables

Recommended personal-MVP tables:

```text
users
daily_food_logs
meal_drafts
bot_sessions
weight_logs
water_logs
exercise_logs
user_schedules
workout_schedules
nutrition_target_history
notification_logs
telegram_updates
```

Optional later:

```text
meal_items
ai_usage_logs
```

Use:

```text
BIGINT
```

for Telegram IDs.

Use:

```text
UUID
```

for normal entity IDs.

Use:

```text
TIMESTAMPTZ
```

for timestamps.

---

# 24. Suggested users Fields

```text
telegram_id
name
bot_alias
gender
age
height_cm
weight_kg
target_weight_kg
goal
activity_level

bmr
tdee

daily_calorie_target
protein_target_g
carbs_target_g
fat_target_g
water_target_ml

timezone

dashboard_token
dashboard_enabled

onboarding_completed

created_at
updated_at
```

---

# 25. Suggested daily_food_logs Fields

```text
id
telegram_id

meal_type
food_name

calories
protein_g
carbs_g
fat_g

sugar_g
fiber_g
sodium_mg

nutrition_score
nutrition_score_version

estimated_portion_g
portion_multiplier

source
ai_confidence

consumed_at
local_date
created_at
updated_at

deleted_at
```

`deleted_at` enables Undo/soft-delete later.

---

# 26. Undo

Recommended small UX feature:

After saving a meal:

```text
Makan siang tersimpan ✅
620 kcal

[ ↩️ Batalkan ]
```

Use soft delete where practical.

This is highly useful for accidental/double logging.

---

# 27. Settings

Recommended post-core command:

```text
/settings
```

Possible settings:

- profile
- goal
- activity level
- bot alias
- timezone
- reminders
- dashboard link reset
- delete account/data

---

# 28. Optional Data Deletion

Even for personal use, keep a future-safe path for deleting all user data.

Potential command:

```text
/delete_account
```

Delete:

- food logs
- weight logs
- water logs
- workouts
- schedules
- sessions
- dashboard token
- user profile

---

# 29. Optional Barcode

Barcode is optional after core MVP.

Flow:

```text
barcode number
→ Open Food Facts
→ normalize nutrients
→ preview
→ save
```

For barcode images, prefer a dedicated barcode decoder or future Mini App camera scanner.

Do not depend entirely on Gemini to read barcode numbers from photos.

---

# 30. Optional Voice Input

Voice may be added later.

Recommended:

```text
Telegram voice
→ temporary download
→ Gemini audio understanding
→ normalized meal
→ preview
→ save
→ discard audio
```

Do not store voice permanently by default.

---

# 31. Free-Tier Optimization Rules

1. Restrict bot using Telegram ID allowlist.
2. Do not store images by default.
3. Do not store voice files.
4. Use deterministic calculations instead of Gemini where possible.
5. Avoid unnecessary Gemini calls.
6. Batch cron work.
7. Avoid scanning all schedules every minute.
8. Keep dashboard server-rendered/read-only.
9. Avoid infrastructure not needed for personal use.
10. Keep logs compact and do not store raw prompts unless necessary.

---

# 32. Environment Variables

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=

ALLOWED_TELEGRAM_IDS=

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

CRON_SECRET=

NEXT_PUBLIC_APP_URL=
```

---

# 33. Security Requirements

1. Check Telegram allowlist before expensive processing.
2. Validate Telegram webhook secret.
3. Protect cron endpoint with `CRON_SECRET`.
4. Service role key is server-only.
5. Gemini API key is server-only.
6. Validate all AI output.
7. Validate user input.
8. Dashboard uses opaque token.
9. Dashboard is read-only.
10. Avoid unnecessary direct browser access to health tables.
11. Do not log secrets.
12. Do not expose raw stack traces.

---

# 34. Bot Personality

Use `name` and `bot_alias` naturally.

Tone:

- friendly
- supportive
- concise
- practical
- non-judgmental

Example:

```text
Sip, Dimas 👍

Makan siangmu kira-kira 610 kcal dengan sekitar 35 g protein.

Masih ada sekitar 720 kcal untuk target hari ini.

Kalau porsinya tadi lebih besar atau kecil, tinggal koreksi ya.

— BroCal
```

---

# 35. MVP Acceptance Criteria

MVP is complete when:

- Telegram webhook works
- Telegram allowlist works
- `/start` onboarding works
- bot alias works
- BMR/TDEE calculations work
- nutrition target history exists
- text meal logging works
- photo meal logging works
- AI structured output is validated
- portion correction works
- meal draft survives serverless requests
- `/hariini` works
- `/bb` works and recalculates target
- water logging works
- workout logging works
- reminders work
- duplicate reminders are prevented
- webhook retries do not create duplicate side effects
- dashboard shows calories, weight, and macros
- dashboard uses opaque token
- typecheck/build/tests pass

---

# 36. Recommended Personal Build Order

## Phase 1 — Foundation
- Next.js
- TypeScript
- env validation
- Supabase
- grammY
- webhook
- Telegram allowlist
- webhook secret
- `/help`

## Phase 2 — User Core
- database
- onboarding
- bot alias
- nutrition calculations
- nutrition target history
- dashboard token

## Phase 3 — Meal MVP
- text meal
- Gemini structured output
- validation
- persistent meal draft
- preview
- portion editing
- save
- `/hariini`

## Phase 4 — Photo
- Telegram image download
- Gemini Vision
- no permanent storage
- same meal draft pipeline

## Phase 5 — Progress
- `/bb`
- water
- workout
- MET-based burn estimate

## Phase 6 — Reminders
- meal schedule
- workout schedule
- `next_run_at`
- Supabase Cron
- notification idempotency

## Phase 7 — Dashboard
- summary cards
- calories bar chart
- weight line chart
- macro donut

## Phase 8 — Polish
- undo
- settings
- error UX
- tests
- logging
- build/deploy docs

## Phase 9 — Optional
- voice
- barcode
- streak
- weekly report
- favorites/templates
