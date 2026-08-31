# Project Pipeline
# CalorieTracker AI Bot & Health Dashboard v5.2 Personal

This document defines the recommended implementation and runtime flow for the personal/free-tier version.

---

# 1. Core Architecture

```text
Telegram User
      ↓
Telegram API
      ↓
Vercel /api/webhook
      ↓
Allowlist Check
      ↓
Webhook Idempotency
      ↓
grammY
      ↓
Bot Handler
      ↓
Service
      ↓
Repository
      ↓
Supabase PostgreSQL
```

AI flow:

```text
Telegram Input
      ↓
Gemini Service
      ↓
Structured Output
      ↓
Runtime Validation
      ↓
Business Validation
      ↓
Meal Draft
      ↓
User Correction
      ↓
Database
```

---

# 2. Project Startup Pipeline

```text
Create/inspect repository
      ↓
Read:
prd.md
prompt.md
pipeline.md
      ↓
Install dependencies
      ↓
Configure environment
      ↓
Create Supabase schema
      ↓
Create grammY bot
      ↓
Create Vercel webhook
      ↓
Configure Telegram webhook
      ↓
Run smoke test
```

---

# 3. Telegram Security Pipeline

```text
Telegram update
      ↓
Validate webhook secret
      ↓
Read telegram_id
      ↓
Allowed ID?
   ├── NO → stop
   └── YES
        ↓
      continue
```

Perform this before Gemini or expensive work.

---

# 4. Webhook Reliability Pipeline

```text
receive update
      ↓
read update_id
      ↓
load/reserve telegram_updates record
      ↓
status?
  processed
      → return 200

  processing + lock fresh
      → return/skip

  failed
      → retry

  processing + stale lock
      → recover/retry

  new
      → process
      ↓
success?
  yes → processed
  no  → failed + last_error
```

---

# 5. Onboarding Pipeline

```text
/start
  ↓
allowed user?
  ↓
existing completed profile?
 ├── YES → welcome back
 └── NO
      ↓
persistent bot session
      ↓
name
      ↓
bot alias
      ↓
gender
      ↓
age
      ↓
height
      ↓
weight
      ↓
target weight
      ↓
activity level
      ↓
goal
      ↓
timezone
      ↓
calculate nutrition targets
      ↓
create dashboard token
      ↓
save user
      ↓
insert nutrition_target_history
      ↓
complete onboarding
```

Session state must live in the database, not memory.

---

# 6. Text Meal Pipeline

```text
User text
   ↓
Meal text handler
   ↓
Gemini structured analysis
   ↓
Zod validation
   ↓
Business validation
   ↓
Create meal_draft
   ↓
Show preview
   ↓
-25% / +25% / Manual / Save
   ↓
Update draft
   ↓
Save daily_food_logs
   ↓
Delete/expire draft
   ↓
Show today's progress
```

---

# 7. Photo Meal Pipeline

Personal version:

```text
Telegram photo
      ↓
download temporarily
      ↓
validate type/size
      ↓
Gemini Vision
      ↓
structured output
      ↓
validate
      ↓
meal_draft
      ↓
portion correction
      ↓
save nutrition data
      ↓
discard temporary image
```

No permanent image storage by default.

---

# 8. Portion Pipeline

Persistent draft contains:

```text
base_nutrition
portion_multiplier
status
expires_at
```

Callbacks:

```text
-25%
→ multiplier -= 0.25

+25%
→ multiplier += 0.25
```

Always calculate:

```text
display_value = base_value × multiplier
```

Do not mutate values repeatedly.

---

# 9. Daily Summary Pipeline

```text
/hariini
    ↓
determine user's local date
    ↓
query today's food
query today's water
query today's workout
    ↓
aggregate deterministically
    ↓
load target active for today
    ↓
render summary
```

Workout calories are shown separately from food allowance.

---

# 10. Weight Update Pipeline

```text
/bb 75
   ↓
validate
   ↓
insert weight_logs
with measured_at
   ↓
update users.weight_kg
   ↓
recalculate BMR/TDEE/targets
   ↓
insert nutrition_target_history
   ↓
respond with change
```

Prefer atomic updates where practical.

---

# 11. Historical Target Pipeline

Whenever target changes:

```text
profile/weight update
      ↓
calculate new target
      ↓
update users current target
      ↓
insert nutrition_target_history
```

Dashboard:

```text
food date
↓
find target effective at that date
↓
compare intake vs historical target
```

---

# 12. Water Pipeline

```text
/air 500
   ↓
validate
   ↓
insert water_logs
with consumed_at
   ↓
sum current local date
   ↓
compare with water target
   ↓
respond
```

---

# 13. Workout Pipeline

```text
/workout lari 30 menit
      ↓
parse activity/duration
      ↓
map to activity/MET
      ↓
calculate estimated kcal
      ↓
insert exercise_logs
with performed_at
      ↓
respond
```

Formula:

```text
kcal/min =
MET × 3.5 × weight_kg / 200
```

---

# 14. Reminder Setup Pipeline

```text
/workout_setup
or reminder setup
      ↓
choose activity/meal type
      ↓
set local scheduled time
      ↓
calculate next_run_at UTC
      ↓
save schedule
```

---

# 15. Reminder Runtime Pipeline

```text
Supabase Cron
     ↓
/api/cron-reminder
     ↓
validate CRON_SECRET
     ↓
query:
is_active = true
next_run_at <= now()
     ↓
for each due schedule
     ↓
check notification occurrence
     ↓
already sent?
  yes → skip
  no
    ↓
send Telegram message
    ↓
insert notification log
    ↓
calculate next occurrence
    ↓
update next_run_at
```

---

# 16. Dashboard Pipeline

```text
GET /dashboard/[dashboard_token]
      ↓
lookup user
      ↓
dashboard enabled?
      ↓
query:
today totals
historical calories
historical targets
weight history
macro totals
      ↓
aggregate server-side
      ↓
render:
summary cards
bar chart
line chart
donut chart
```

Recommended:

```text
noindex
no long-lived public cache
```

---

# 17. Database Pipeline

Recommended access pattern:

```text
Handler
  ↓
Service
  ↓
Repository
  ↓
Supabase
```

Core tables:

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

---

# 18. Testing Pipeline

## Unit

Test:

```text
BMR
TDEE
calorie target
macro target
nutrition score
portion multiplication
MET workout calculation
timezone local date
historical target lookup
reminder due calculation
```

## Integration

Test:

```text
webhook idempotency
meal draft persistence
weight update + target history
reminder duplicate prevention
dashboard token lookup
```

Mock external APIs when needed.

---

# 19. Recommended Milestones

## Milestone 0 — Bootstrap

```text
Next.js
TypeScript
env validation
Supabase client
grammY
webhook
Telegram allowlist
webhook secret
/help
```

## Milestone 1 — User Core

```text
schema
repositories
onboarding
bot alias
nutrition engine
nutrition target history
dashboard token
```

## Milestone 2 — Meal Text MVP

```text
Gemini service
structured output
runtime validation
meal draft
portion editing
save
/hariini
```

## Milestone 3 — Photo

```text
Telegram photo download
Gemini Vision
temporary processing
same meal draft flow
```

## Milestone 4 — Progress

```text
/bb
/air
/workout
MET calculation
```

## Milestone 5 — Reminder

```text
schedule setup
next_run_at
Supabase Cron
notification_logs
duplicate prevention
```

## Milestone 6 — Dashboard

```text
summary cards
calorie vs historical target
weight trend
macro donut
```

## Milestone 7 — Polish

```text
Undo
/settings
better errors
tests
logging
deployment docs
```

## Milestone 8 — Optional

```text
voice
barcode
streak
weekly report
favorites
CSV export
```

---

# 20. CI / Validation Pipeline

For every meaningful change:

```text
install
↓
typecheck
↓
lint
↓
tests
↓
build
```

Typical:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

Use the scripts actually defined in `package.json`.

---

# 21. Deployment Pipeline

```text
Git repository
      ↓
Supabase project
      ↓
apply schema
      ↓
Vercel project
      ↓
configure env
      ↓
deploy
      ↓
register Telegram webhook
      ↓
test /start
      ↓
test text meal
      ↓
test photo meal
      ↓
configure Supabase Cron
      ↓
test reminders
      ↓
verify dashboard
```

---

# 22. Optional Later Pipeline

Only after core MVP is stable:

```text
Voice
Barcode
Streak
Weekly report
Favorites
Meal templates
CSV export
Mini App scanner
```

Do not delay the core meal tracking experience for these features.

---

# 23. Core Engineering Rule

Normal features:

```text
INPUT
→ VALIDATE
→ NORMALIZE
→ PROCESS
→ PERSIST
→ RESPOND
→ OBSERVE
```

AI features:

```text
USER INPUT
→ AI
→ STRUCTURED OUTPUT
→ SCHEMA VALIDATION
→ BUSINESS VALIDATION
→ USER CORRECTION
→ DATABASE
```

Scheduled features:

```text
CRON
→ AUTHENTICATE
→ QUERY DUE WORK
→ CHECK IDEMPOTENCY
→ EXECUTE
→ RECORD RESULT
→ SCHEDULE NEXT RUN
```
