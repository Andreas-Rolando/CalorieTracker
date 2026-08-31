# CalorieTracker AI Bot & Health Dashboard (v5.2 Personal)

Personal, non-commercial Telegram calorie tracker bot + read-only web
dashboard. See `prd.md`, `prompt.md`, and `pipeline.md` for the full spec —
those files are the source of truth for this project.

## Stack

TypeScript, Next.js App Router, Tailwind CSS, grammY, Supabase PostgreSQL,
`@google/genai` (Gemini Flash), Recharts, Vercel, Supabase Cron.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in the values:

   - `TELEGRAM_BOT_TOKEN` — from [@BotFather](https://t.me/BotFather).
   - `TELEGRAM_WEBHOOK_SECRET` — any random string; Telegram echoes it back
     on every webhook call so we can verify the request came from Telegram.
   - `ALLOWED_TELEGRAM_IDS` — comma-separated Telegram user IDs allowed to
     use the bot (get your ID from [@userinfobot](https://t.me/userinfobot)).
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — from your Supabase
     project settings (Project Settings → API).
   - `NEXT_PUBLIC_APP_URL` — the public URL this app is deployed at (used to
     build dashboard links sent via Telegram).

3. Apply the database schema in `supabase/migrations/0001_init.sql` to your
   Supabase project (SQL editor, or `supabase db push` if using the CLI).

4. Run the dev server:

   ```bash
   npm run dev
   ```

5. Point Telegram at your webhook once deployed (or via a tunnel like ngrok
   for local testing):

   ```bash
   curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
     -d "url=<NEXT_PUBLIC_APP_URL>/api/telegram/webhook" \
     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```

## Scripts

```bash
npm run dev        # start dev server
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm run lint         # eslint
npm test             # vitest run
```

## Project status

Implemented so far: webhook + allowlist + idempotency, `/help`, `/start`
onboarding, deterministic nutrition engine, nutrition target history,
dashboard token issuance, text meal logging via Gemini structured output
(persistent `meal_drafts` + portion correction), and `/hariini`. See
`progress.md` for the detailed change log and `pipeline.md` section 19 for
the full milestone list and what's next.
