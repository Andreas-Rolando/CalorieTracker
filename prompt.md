# Coding Agent Context
# CalorieTracker AI Bot & Health Dashboard v5.2 Personal

You are the coding agent for this project.

Before changing code, read:

```text
prd.md
pipeline.md
prompt.md
```

Treat those files as the source of truth.

## Project Summary

This is a personal, non-commercial Telegram calorie tracker and fitness buddy.

Main stack:

```text
TypeScript
Next.js App Router
Tailwind CSS
grammY
Supabase PostgreSQL
@google/genai
Gemini Flash
Recharts
Supabase Cron
Vercel
```

Optional later:

```text
Open Food Facts
voice input
barcode input
```

## Important Rules Not To Miss

1. This is primarily a personal-use project. Restrict Telegram access using:

```env
ALLOWED_TELEGRAM_IDS=
```

Check the allowlist before expensive Gemini/database processing.

2. Do not permanently store meal photos by default.

Recommended:

```text
Telegram photo
→ temporary download
→ Gemini
→ nutrition data
→ discard image
```

3. Vercel Serverless state is not persistent.

Do not store onboarding sessions or pending meal edits only in memory.

Use persistent:

```text
bot_sessions
meal_drafts
```

4. Preserve historical nutrition targets using:

```text
nutrition_target_history
```

Do not compare old food logs against only the user's newest calorie target.

5. Store event time separately from record creation time where relevant:

```text
consumed_at
measured_at
performed_at
created_at
```

Respect user timezone for daily grouping.

6. Telegram webhook processing must be recoverable and idempotent.

Use update states such as:

```text
processing
processed
failed
```

and allow retry of failed/stale processing records.

7. Validate Telegram webhook secret using:

```env
TELEGRAM_WEBHOOK_SECRET=
```

8. Gemini must use structured output with runtime validation such as Zod.

Never rely on regex parsing of free-form AI responses.

9. Prefer deterministic application logic for:

```text
BMR
TDEE
calorie target
macro targets
nutrition score
daily totals
weekly totals
exercise calories
streaks
reminder scheduling
```

Use Gemini only where language/image/audio understanding is useful.

10. Exercise calorie estimation should preferably use MET-based calculations, not arbitrary AI guesses.

11. Reminders should use a centralized dispatcher and `next_run_at`.

Do not scan every schedule unnecessarily every minute.

12. Supabase Cron is for frequent reminder scheduling.

Vercel Cron is only for low-frequency jobs such as optional weekly reports.

13. Dashboard route should use:

```text
/dashboard/[dashboard_token]
```

not Telegram ID as a public credential.

14. Keep the project free-tier friendly.

Avoid unnecessary:

```text
image storage
voice storage
Gemini calls
queues
Redis
microservices
paid infrastructure
```

15. Keep architecture approximately:

```text
Telegram Handler
↓
Service
↓
Repository
↓
Supabase
```

Keep handlers thin.

## Working Style

For every task:

1. inspect the repository,
2. read the relevant sections of the three markdown docs,
3. continue from the existing state instead of rebuilding working code,
4. make the smallest coherent change,
5. update SQL/types/tests when required,
6. run available typecheck/lint/tests/build,
7. fix errors introduced by your changes,
8. do not claim success unless verified.

After each task, summarize briefly:

```text
Implemented
Files Changed
Database Changes
Environment Changes
Validation
Remaining Issues
Recommended Next Step
```

If no explicit task is given, inspect the repository and continue from the earliest incomplete milestone in `pipeline.md`.
