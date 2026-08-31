# Progress Log

**CalorieTracker AI Bot & Health Dashboard v5.2 Personal**

Append-only log of work done on this project. Source of truth for scope
remains `prd.md` / `prompt.md` / `pipeline.md` — this file only records
*what has actually been implemented*, in the order it happened, so any
session (human or agent) can see current state without re-reading the full
history.

Each entry follows the report format from `prompt.md` §"Working Style":
Implemented, Files Changed, Database Changes, Environment Changes,
Validation, Remaining Issues, Recommended Next Step.

---

## 2026-08-31 — Milestone 0 (Bootstrap) + Milestone 1 (User Core)

**Implemented**
- Next.js App Router + TypeScript scaffold (Next 16.3.3, React 19,
  Tailwind, ESLint), `typecheck`/`test` npm scripts added (Vitest).
- Zod-validated env loading (`lib/env.ts`), fails fast with a clear error
  if required vars are missing.
- Supabase service-role client (`lib/supabase/admin.ts`), server-only.
- Telegram allowlist (`lib/telegram/allowlist.ts`), checked as the first
  grammY middleware before any command/DB work; unauthorized updates are
  silently ignored.
- Webhook endpoint (`app/api/telegram/webhook/route.ts`): validates
  `TELEGRAM_WEBHOOK_SECRET` with a timing-safe comparison, then reserves
  the `update_id` via an idempotency RPC before calling the bot. Implements
  the recover/retry pipeline from `pipeline.md` §4 (processed → skip,
  processing+fresh lock → skip, processing+stale lock or failed →
  reprocess, success → processed, failure → 500 so Telegram retries).
- Deterministic nutrition engine (`lib/nutrition/engine.ts`): BMR
  (Mifflin-St Jeor), TDEE, calorie target (with a safe floor), macro
  targets, water target. 12 Vitest unit tests, all passing.
- `/help` and `/start` commands. `/start` drives a fully persistent
  onboarding state machine (`lib/telegram/onboarding.ts`) backed by
  `bot_sessions` — no in-memory state. On completion it computes targets,
  creates the `users` row, an opaque `dashboard_token`, and a
  `nutrition_target_history` snapshot.
- Repositories for `users`, `bot_sessions`, `nutrition_target_history`,
  `telegram_updates`.
- Replaced the default Next.js starter homepage/metadata with a minimal
  placeholder.

**Files Changed**
- Added: `lib/**`, `app/api/telegram/webhook/route.ts`,
  `supabase/migrations/0001_init.sql`, `vitest.config.ts`, `.env.example`.
- Modified: `app/page.tsx`, `app/layout.tsx`, `package.json`, `README.md`,
  `.gitignore` (fixed `.env*` accidentally also ignoring `.env.example`).
- Repo scaffolded from scratch (Next.js + git init) — was empty except the
  four doc files.

**Database Changes**
- `supabase/migrations/0001_init.sql`: all tables from PRD §23 (`users`,
  `bot_sessions`, `meal_drafts`, `daily_food_logs`, `weight_logs`,
  `water_logs`, `exercise_logs`, `nutrition_target_history`,
  `user_schedules`, `workout_schedules`, `notification_logs`,
  `telegram_updates`), plus a `reserve_telegram_update()` Postgres function
  implementing the atomic idempotency/recovery logic.
- **Not yet applied** — no Supabase project is connected; must be run
  against a real project.

**Environment Changes**
- `.env.example` added (now correctly tracked by git) documenting all vars
  from PRD §32.
- A local `.env.local` with placeholder values was created only so
  `npm run build` could be verified — must be replaced with real
  credentials before running for real.

**Validation**
- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm test` ✅ (12/12)
- `npm run build` ✅ (webhook route correctly reported as dynamic `ƒ`)

**Remaining Issues**
- No live Supabase/Telegram credentials in this environment — migration
  and webhook registration are unverified against real services.
- `getSupabaseAdmin()` client is untyped (no generated `Database` types
  yet — run `supabase gen types` once the project is linked).
- Onboarding uses plain numbered-text answers for gender/activity/goal
  rather than inline keyboards (kept simple per project rules; easy
  upgrade later).
- Nutrition score (per-meal) intentionally deferred — it belongs to the
  Gemini meal pipeline (Milestone 2), not the profile engine.

**Recommended Next Step**
- Apply the migration to a real Supabase project, set real env vars,
  register the Telegram webhook, and smoke-test `/start` end-to-end.
- Then continue with **Milestone 2 (Meal Text MVP)**: Gemini service + Zod
  schema validation for `MealAnalysis`, `meal_drafts` persistence, portion
  adjustment inline keyboard, and `/hariini`.

---

## 2026-08-31 — Progress log + enforcement

**Implemented**
- Created this file (`progress.md`) as an append-only log of everything
  implemented in the repo, backfilled with the Milestone 0/1 entry above.
- Added a durable instruction in `CLAUDE.md` requiring every future task
  or session to append a dated entry to `progress.md` before finishing
  (report format per `prompt.md`), so this stays up to date automatically
  regardless of whether the user asks for it explicitly.

**Files Changed**
- Added: `progress.md`.
- Modified: `CLAUDE.md`.

**Database Changes** — none.

**Environment Changes** — none.

**Validation** — docs-only change; no build/test/lint impact.

**Remaining Issues** — none.

**Recommended Next Step** — continue with Milestone 2 (Meal Text MVP) as
noted above.

---

## 2026-08-31 — Milestone 2 (Meal Text MVP)

**Implemented**
- Gemini structured-output service (`lib/gemini/client.ts`,
  `lib/gemini/mealAnalysis.ts`): calls `gemini-2.5-flash` via `@google/genai`
  with `responseMimeType: "application/json"` and a `responseJsonSchema`
  generated from the Zod schema (`z.toJSONSchema`), so the model is
  constrained at the API level, not just parsed hopefully.
- `lib/gemini/mealAnalysisSchema.ts`: Zod schema matching PRD §9
  (`meal_name`, `items[]`, `totals`, `confidence`, `recommendation`) with
  business-bound sanity ceilings (non-negative, capped magnitudes,
  confidence 0..1) so clearly absurd Gemini output is rejected rather than
  trusted. `lib/utils/stripNulls.ts` normalizes stray `null`s from the
  model before validation.
- Deterministic totals: `lib/nutrition/mealTotals.ts` recomputes meal
  totals by summing `items[]` in application code rather than trusting
  Gemini's own `totals` field, and scales totals by the portion
  multiplier — consistent with "prefer deterministic logic over AI
  output" (prompt.md rule 9).
- Persistent meal draft flow (`lib/telegram/mealDraft.ts`,
  `lib/repositories/mealDrafts.ts`): text message → Gemini analysis →
  `meal_drafts` row → inline-keyboard preview (`➖25% / ➕25% / Edit Manual
  / ✅ Simpan`). Portion buttons edit the same message in place; "Edit
  Manual" starts a short `bot_sessions` sub-flow (flow=`meal_edit`) that
  parses 4 space-separated numbers and overrides the draft's totals
  outright (multiplier reset to 1x). "Simpan" writes to
  `daily_food_logs` (via new `lib/repositories/dailyFoodLogs.ts`), marks
  the draft `saved`, and replies with a confirmation + today's updated
  summary. All state is DB-backed — no in-memory pending-meal state.
- `/hariini`: food calories/macros consumed vs the nutrition target
  *active at that point in time* (`getActiveNutritionTarget` added to
  `lib/repositories/nutritionTargetHistory.ts`, per PRD §18), via new
  `lib/telegram/dailySummary.ts`. Shared by both the `/hariini` command
  and the post-save confirmation message.
- `lib/dateUtils.ts`: `getLocalDateString(date, timezone)` — used to stamp
  `daily_food_logs.local_date` and to pick "today" for `/hariini`, so
  daily grouping respects the user's timezone (PRD §19) instead of UTC.
- Any plain-text message from an onboarded user is now treated as a meal
  description (goal #1: "meal logging semudah mengirim chat Telegram").
  Unrecognized `/commands` get a "not recognized" reply instead of being
  sent to Gemini as food.
- `GEMINI_API_KEY` flipped from optional to required in `lib/env.ts`
  (meal logging now genuinely depends on it).

**Files Changed**
- Added: `lib/gemini/**`, `lib/nutrition/mealTotals.ts` (+ test),
  `lib/repositories/mealDrafts.ts`, `lib/repositories/dailyFoodLogs.ts`,
  `lib/telegram/mealDraft.ts`, `lib/telegram/dailySummary.ts`,
  `lib/dateUtils.ts`, `lib/utils/stripNulls.ts` (+ test).
- Modified: `lib/env.ts` (GEMINI_API_KEY required),
  `lib/repositories/nutritionTargetHistory.ts` (added
  `getActiveNutritionTarget`), `lib/telegram/bot.ts` (wired up
  `callback_query:data` handler, `/hariini`, meal-edit session routing,
  text→meal-analysis dispatch), `package.json` (added `@google/genai`).

**Database Changes** — none beyond what `0001_init.sql` already defined
(`meal_drafts`, `daily_food_logs` were already in the schema from
Milestone 0/1; this entry just starts writing to them). No new migration.

**Environment Changes** — `GEMINI_API_KEY` is now a hard requirement (was
documented but optional before). No new variables.

**Validation**
- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm test` ✅ (26/26 — added meal-totals, meal-analysis-schema, and
  stripNulls unit tests)
- `npm run build` ✅
- **Not** exercised against a live Gemini API key or real Telegram
  updates in this environment — schema/plumbing verified, not live model
  behavior.

**Remaining Issues**
- `responseJsonSchema` behavior (in particular, whether Gemini reliably
  honors the nested `anyOf`/array-`type` shapes `z.toJSONSchema` emits for
  optional numeric fields) is unverified against the live API — worth a
  manual smoke test with a real `GEMINI_API_KEY` before relying on it.
- Manual edit only supports overriding the 4 macro totals (no per-item
  editing, no meal name edit) — acceptable for MVP per PRD's minimal
  "Edit Manual" ask, but a known simplification.
- No Undo button after save yet (PRD §26 — explicitly listed as
  post-core polish, Milestone 7).
- `/hariini` covers food only; water/workout aggregation is deferred
  until `/air` and `/workout` exist (Milestone 4), since those tables
  don't yet have a `local_date` column for cheap same-day filtering.

**Recommended Next Step**
- Smoke-test end-to-end against a real Supabase project + Telegram bot +
  Gemini key: `/start` → send a meal description → adjust portion → save
  → `/hariini`.
- Then **Milestone 3 (Photo)**: Telegram photo download, Gemini Vision
  analysis reusing the same `meal_drafts` pipeline, no permanent image
  storage.
