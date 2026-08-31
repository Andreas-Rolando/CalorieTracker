# Initial Prompt for Coding Agent

Saya ingin kamu mulai mengerjakan project **CalorieTracker AI Bot & Health Dashboard v5.2 Personal**.

Sebelum menulis atau mengubah code apa pun, baca seluruh file berikut di root project:

```text
prd.md
prompt.md
pipeline.md
```

Ketiga file tersebut adalah source of truth project.

Project ini adalah **Telegram calorie tracker pribadi/non-commercial** dengan stack utama:

```text
TypeScript
Next.js App Router
Tailwind
grammY
Supabase PostgreSQL
@google/genai
Gemini Flash
Recharts
Vercel
Supabase Cron
```

Hal penting:

- bot hanya untuk Telegram ID yang ada di `ALLOWED_TELEGRAM_IDS`;
- jangan simpan foto makanan permanen untuk MVP;
- jangan gunakan state in-memory untuk onboarding atau meal draft;
- gunakan `bot_sessions` dan `meal_drafts`;
- gunakan structured Gemini output + runtime validation;
- semua BMR/TDEE/macros/target/workout calories dihitung deterministic;
- simpan `nutrition_target_history`;
- webhook Telegram harus recoverable dan idempotent;
- gunakan `TELEGRAM_WEBHOOK_SECRET`;
- reminder gunakan `next_run_at` + Supabase Cron;
- dashboard gunakan opaque `dashboard_token`;
- jaga semuanya tetap sederhana dan free-tier friendly.

Sekarang lakukan ini:

1. Inspect repository dan `package.json`.
2. Baca `prd.md`, `prompt.md`, dan `pipeline.md`.
3. Tentukan milestone saat ini berdasarkan `pipeline.md`.
4. Jika project masih kosong, mulai dari **Milestone 0 — Bootstrap**.
5. Jika sudah ada implementasi, lanjutkan dari milestone paling awal yang belum lengkap.
6. Jangan rewrite code yang sudah bekerja tanpa alasan.
7. Setelah perubahan, jalankan typecheck/lint/test/build yang tersedia.
8. Fix error yang disebabkan perubahanmu.
9. Laporkan secara singkat:
   - Implemented
   - Files Changed
   - Database Changes
   - Environment Changes
   - Validation
   - Remaining Issues
   - Recommended Next Step

Mulai sekarang dengan inspect repository dan implementasikan fondasi yang masih kurang.
