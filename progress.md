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

---

## 2026-09-01 — First real deployment + smoke-test fixes

**Implemented**
- Deployed to Vercel (`https://calorie-tracker-ruby-seven.vercel.app`),
  connected to the GitHub repo for auto-deploy on push. Applied
  `0001_init.sql` to the real Supabase project.
- Registered the Telegram webhook (`setWebhook` with the real
  `TELEGRAM_WEBHOOK_SECRET`) — confirmed healthy via `getWebhookInfo`
  (no `last_error_message`, `pending_update_count: 0`).
- Fixed a build-time crash: `lib/env.ts` required `NEXT_PUBLIC_APP_URL`
  with no fallback, so a misconfigured/unsaved value on Vercel failed the
  *entire* build (`Failed to collect configuration for
  /api/telegram/webhook`). Now falls back to Vercel's auto-injected
  `VERCEL_URL` when `NEXT_PUBLIC_APP_URL` is unset, so a missing value
  degrades gracefully instead of blocking deploys. Explicitly setting
  `NEXT_PUBLIC_APP_URL` is still recommended for link stability.
- Fixed onboarding UX found during the real smoke test: the `timezone`
  step required an exact-case IANA name, so real users typing "jakarta"
  or "asia/jakarta" got stuck in a rejection loop. Added
  `lib/telegram/timezone.ts` (`normalizeTimezone`) accepting bare
  Indonesian city names, WIB/WITA/WIT abbreviations, and any casing, with
  a case-insensitive fallback against the full IANA list. Extracted out
  of `onboarding.ts` (which is `server-only`-guarded) specifically so it
  stays unit-testable.

**Files Changed**
- Modified: `lib/env.ts` (VERCEL_URL fallback), `lib/telegram/onboarding.ts`
  (uses the new normalizer).
- Added: `lib/telegram/timezone.ts` (+ `timezone.test.ts`).

**Database Changes** — none (migration from Milestone 0 applied as-is to
the real project).

**Environment Changes** — real values now live in Vercel project env vars
(Telegram token, webhook secret, Supabase keys, Gemini key,
`NEXT_PUBLIC_APP_URL` pointed at the Vercel domain). No new variables
introduced.

**Validation**
- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm test` ✅ (32/32)
- `npm run build` ✅
- Live: webhook registered and healthy per `getWebhookInfo`; onboarding
  flow reached the timezone step in real usage (which surfaced the bug
  just fixed) — full `/start` → save meal → `/hariini` flow not yet
  confirmed end-to-end after this fix.

**Remaining Issues**
- End-to-end smoke test (onboarding → meal save → `/hariini`) still
  needs to be re-run against the deployed bot now that the timezone fix
  is live.
- The Telegram bot token was pasted in plaintext during setup
  conversation earlier — recommended the user rotate it via @BotFather
  once testing is done; unconfirmed whether that happened.

**Recommended Next Step**
- Re-run the full smoke test against the live deployment (onboarding
  through timezone, meal logging, portion correction, `/hariini`).
- Then continue to **Milestone 3 (Photo)** as previously planned.

---

## 2026-09-01 — Gemini responseJsonSchema: minimum/maximum silently unsupported

**Implemented**
- Root-caused the meal-logging 400 `INVALID_ARGUMENT` from real webhook
  traffic (visible in `telegram_updates.last_error`) by bisecting the
  actual schema against the live Gemini API with a series of throwaway
  local scripts (removed after use, not committed): stripped the schema
  down piece by piece until isolating the exact cause.
- **Finding**: contrary to the `@google/genai` SDK's own doc comment
  (which lists `minimum`/`maximum` as supported for `responseJsonSchema`
  alongside `minItems`/`maxItems`), the live API rejects any schema
  containing numeric `minimum`/`maximum` with 400 INVALID_ARGUMENT.
  `minItems`/`maxItems` on arrays work fine. Confirmed via isolated
  before/after tests, then confirmed end-to-end with the app's actual
  generated schema and prompt.
- `lib/gemini/mealAnalysisSchema.ts`: removed `minimum`/`maximum` from
  `GEMINI_JSON_SCHEMA_SUPPORTED_KEYS`, so they're pruned the same way
  `minLength`/`maxLength` already were. All business-value bounds are
  still enforced by `mealAnalysisSchema.safeParse()` at runtime — this
  only affects what's sent to Gemini, not what we accept back.
  Documented the discrepancy from the SDK docs directly in the code
  comment so a future reader isn't misled by the official-looking list.
- Along the way, discovered the free tier for `gemini-3.6-flash` (the
  non-lite Flash model) is capped at **20 requests/day**, and real
  webhook retry traffic plus debugging exhausted it mid-investigation
  (surfaced as 429 RESOURCE_EXHAUSTED, distinct from the 400 being
  chased). Switched default/local `GEMINI_MODEL` to
  `gemini-flash-lite-latest` — an alias that tracks whichever lite
  model is current, which should also make the app more resistant to
  the kind of breakage `gemini-2.5-flash` deprecating caused earlier
  today.
- Added a regression test (`mealAnalysisSchema.test.ts`) asserting the
  generated schema never contains `minLength`/`maxLength`/`minimum`/
  `maximum`/`$schema`, and that `minItems`/`maxItems` are still present.

**Files Changed**
- Modified: `lib/gemini/mealAnalysisSchema.ts`,
  `lib/gemini/mealAnalysisSchema.test.ts`, `lib/env.ts` (model default),
  `.env.example`.
- No files left behind: all live-API bisection scripts were scratch
  files outside the repo's tracked structure, deleted after use.

**Database Changes** — none. (Two throwaway rows I inserted into
`telegram_updates` while testing — `999999001` and `900000001` — were
deleted afterward.)

**Environment Changes** — `.env.local`'s `GEMINI_MODEL` updated to
`gemini-flash-lite-latest`. **The same change still needs to be made in
Vercel's project env vars** (explicit env values there override the
code's default) — not yet confirmed done.

**Validation**
- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm test` ✅ (34/34)
- `npm run build` ✅
- Live: confirmed end-to-end against the real Gemini API using the
  app's actual generated schema, system instruction, and prompt shape —
  got back a well-formed, schema-conforming meal analysis.

**Remaining Issues**
- Vercel's `GEMINI_MODEL` env var still needs updating to
  `gemini-flash-lite-latest` (or whatever the user prefers) and
  redeploying — the code fix alone doesn't take effect in production
  until that's done.
- Telegram was still showing a backlog of pending webhook updates
  (`pending_update_count: 7`) as of the last check, including the
  original stuck meal-logging message and a `/start` sent during
  testing. Telegram delivers webhook updates in order and won't
  advance past a failing one, so this should self-resolve once the
  fix is live and Telegram's automatic retry reaches that update
  again — not yet confirmed.
- The free-tier daily quota (20/day on Flash, unknown-but-likely-higher
  on Flash-Lite) is a real constraint worth keeping in mind for a bot
  meant to log every meal/water/workout — may need billing enabled on
  the Google Cloud project if usage grows past whatever Flash-Lite's
  free limit turns out to be.

**Recommended Next Step**
- User: update `GEMINI_MODEL` to `gemini-flash-lite-latest` in Vercel,
  redeploy, then re-send a meal description to the bot to confirm it
  works live end-to-end (not just against the API directly, as done
  here).
- Then re-run the full smoke test (onboarding → meal save → portion
  correction → `/hariini`) and continue to Milestone 3 (Photo).

---

## 2026-09-01 — Cap webhook retries per update

**Implemented**
- User asked directly: bound webhook retries so a permanently-failing
  update can't keep burning Gemini quota forever. Previously, any
  non-`GeminiAnalysisError` failure (raw SDK errors — the 400/429s from
  the session above) propagated out of `bot.handleUpdate`, got marked
  `failed`, and the webhook returned 500 — which makes Telegram retry
  the *same* update indefinitely, re-running the full (possibly
  quota-limited) Gemini call every time.
- `reserve_telegram_update` now takes a `p_max_attempts` param (default
  5, migration `0002_reserve_telegram_update_max_attempts.sql`, applied
  via `CREATE OR REPLACE FUNCTION` since `0001` was already live). Once
  an update_id's `attempt_count` reaches that cap — whether it's
  sitting as `failed` or stuck with a stale `processing` lock — the
  function returns `'abandon'` instead of reclaiming it again.
- `lib/repositories/telegramUpdates.ts`: `UpdateReservation` gained the
  `"abandon"` variant; `MAX_ATTEMPTS = 5` constant.
- `app/api/telegram/webhook/route.ts`: on `abandon`, stops Telegram's
  retry loop by responding 200 (instead of continuing to 500-and-retry),
  and best-effort notifies the user directly via a raw `sendMessage`
  call (`lib/telegram/fallbackMessage.ts`) so a dropped message doesn't
  just silently vanish — "Maaf, aku gagal memproses pesan itu setelah
  beberapa kali coba. Coba kirim ulang ya."

**Files Changed**
- Added: `supabase/migrations/0002_reserve_telegram_update_max_attempts.sql`,
  `lib/telegram/fallbackMessage.ts`.
- Modified: `lib/repositories/telegramUpdates.ts`,
  `app/api/telegram/webhook/route.ts`.

**Database Changes** — new migration `0002` (function replacement only,
no schema/table changes). **Not yet applied** to the live Supabase
project — needs to be run via SQL Editor like `0001` was.

**Environment Changes** — none.

**Validation**
- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm test` ✅ (34/34 — unchanged; `reserveTelegramUpdate` and
  `extractChatId` are thin integration/glue code not covered by unit
  tests, consistent with how the rest of the repository layer is
  tested in this project)
- `npm run build` ✅
- Not exercised live yet — migration `0002` needs applying first.

**Remaining Issues**
- Migration `0002` needs to be applied to Supabase before this takes
  effect in production.
- `GEMINI_MODEL=gemini-flash-lite-latest` still needs updating in
  Vercel's env vars (from the previous entry) — unconfirmed whether
  done yet.

**Recommended Next Step**
- Apply `0002_reserve_telegram_update_max_attempts.sql` via Supabase
  SQL Editor.
- Confirm `GEMINI_MODEL` is updated in Vercel and redeployed.
- Re-run the full smoke test, then continue to Milestone 3 (Photo).

---

## 2026-09-01 — Confirmed live: retry cap + real meal logging working

**Implemented** — no code changes, verification only.
- Confirmed migration `0002` is live (RPC accepts `p_max_attempts`).
- Confirmed the webhook backlog fully drained (`pending_update_count:
  0`) and the last ~10 `telegram_updates` are all `status: processed`
  with no stuck/failed rows.
- Confirmed real meal logging is working end-to-end via actual user
  traffic: "Mie Ayam" (480 kcal) and "Americano Tanpa Gula" (5 kcal)
  both landed in `daily_food_logs` with sensible macros, sourced from
  real `/start` → text meal → save flows.
- Flagged to the user that one successful save only got through after
  8 attempts against `gemini-3.6-flash` (visible in that update's
  `last_error`, a stale 429 from before it eventually succeeded) —
  meaning `GEMINI_MODEL` likely hadn't actually been switched to
  `gemini-flash-lite-latest` in Vercel yet at that point. Asked the
  user to double check.

**Files Changed** — none.

**Database Changes** — cleaned up two more throwaway test rows in
`telegram_updates` (`999999002`, from re-verifying migration `0002`).

**Environment Changes** — none by me; user was asked to confirm
`GEMINI_MODEL` in Vercel.

**Validation** — read-only checks against live Supabase/Telegram data,
no build/test impact.

**Remaining Issues** — same as before: unconfirmed whether
`GEMINI_MODEL` was actually switched in Vercel.

**Recommended Next Step** — proceed to Milestone 3 regardless (done in
the entry below), but still worth the user confirming the Vercel env
var so future quota exhaustion degrades gracefully (fallback message)
instead of needing several retries.

---

## 2026-09-01 — Milestone 3 (Photo)

**Implemented**
- User sent a real photo of a snack's nutrition-facts label and got no
  response (photo handling didn't exist yet) — asked for it to "langsung
  di kalkulasi". Implemented photo meal logging reusing the existing
  `meal_drafts` pipeline end to end.
- `lib/telegram/photoDownload.ts`: downloads a Telegram file by
  `file_path` into memory as base64 (10MB guard; Telegram itself caps
  bot downloads at 20MB). Never written to disk/storage.
- `lib/gemini/mealAnalysis.ts`: added `analyzeMealPhoto()`, refactored
  to share response parsing/validation (`generateAnalysis`) with
  `analyzeMealText()`. Uses `createPartFromBase64` +
  `createUserContent` from `@google/genai` to build a multimodal
  request, with the *same* `MEAL_ANALYSIS_JSON_SCHEMA` used for text.
- Photo-specific system instruction handles two cases: (1) a nutrition
  label — read the printed per-serving values directly rather than
  estimating, use the label's serving size (e.g. "Takaran Saji: 39g")
  as the base portion so the user can still correct with ±25%; (2) a
  plate of food — visual estimation, same as before.
- `lib/telegram/mealDraft.ts`: added `startMealPhotoAnalysis()`,
  factored `createDraftFromAnalysis()` out of `startMealAnalysis()` so
  both entry points share draft creation + preview rendering.
- `lib/telegram/bot.ts`: `message:photo` handler — checks onboarding,
  sends a "typing" chat action (vision calls take longer than text),
  downloads via `ctx.getFile()`, then calls `startMealPhotoAnalysis`.
  Updated `/help` text to mention photos.
- Deliberately did **not** implement true barcode-number decoding (PRD
  section 29) — reading a printed nutrition table is a different,
  more-reliable-for-Gemini task than decoding a barcode symbol, and the
  PRD itself recommends a dedicated decoder library for that, not
  Gemini. If the user wants actual barcode scanning (not just reading
  a visible nutrition label), that's still a separate future feature.

**Files Changed**
- Added: `lib/telegram/photoDownload.ts`.
- Modified: `lib/gemini/mealAnalysis.ts`, `lib/telegram/mealDraft.ts`,
  `lib/telegram/bot.ts`.

**Database Changes** — none (reuses `meal_drafts`/`daily_food_logs`
from Milestone 0, `source: "photo"` was already a valid enum value).

**Environment Changes** — none.

**Validation**
- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm test` ✅ (34/34 — no new unit tests; the new code is
  Telegram/Gemini integration glue, consistent with how
  `startMealAnalysis`/the webhook route aren't unit tested either)
- `npm run build` ✅
- Live: one careful single-shot test against the real Gemini API with
  a synthetic 1x1 image, confirming the multimodal request shape
  (`createPartFromBase64`/`createUserContent`) and schema are accepted
  — Gemini correctly returned `confidence: 0` and "no food visible"
  for the blank image, i.e. graceful degradation works as designed.
  **Not yet tested with a real food/label photo end-to-end through the
  actual bot** — quota-conscious, left that for the user to try.

**Remaining Issues**
- Not yet confirmed against a real nutrition-label or food photo sent
  through the live bot (only a synthetic blank-image API call was
  tested directly, to conserve quota).
- Photo mime type is hardcoded to `image/jpeg` (correct for Telegram's
  compressed `message.photo`, which is what the handler listens for —
  would need adjusting if uncompressed `message.document` image
  uploads are ever supported).
- True barcode decoding remains unimplemented (by design, see above).

**Recommended Next Step**
- User: send a real meal or nutrition-label photo to the bot and
  confirm the draft preview, portion correction, and save all work.
- Then continue with **Milestone 4 (Progress)**: `/bb`, `/air`,
  `/workout`, MET-based calorie burn.
