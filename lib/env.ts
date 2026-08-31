import { z } from "zod";

const telegramIdList = z
  .string()
  .min(1, "ALLOWED_TELEGRAM_IDS must contain at least one Telegram ID")
  .transform((value, ctx) => {
    const ids = value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const id = Number(part);
        if (!Number.isInteger(id) || id <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid Telegram ID in ALLOWED_TELEGRAM_IDS: "${part}"`,
          });
          return z.NEVER;
        }
        return id;
      });
    return ids;
  });

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
  TELEGRAM_WEBHOOK_SECRET: z
    .string()
    .min(1, "TELEGRAM_WEBHOOK_SECRET is required"),
  ALLOWED_TELEGRAM_IDS: telegramIdList,

  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),

  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),

  CRON_SECRET: z.string().min(1).optional(),

  NEXT_PUBLIC_APP_URL: z
    .string()
    .url("NEXT_PUBLIC_APP_URL must be a valid URL"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment variables. Check .env.example for the full list.\n${issues}`
    );
  }
  return parsed.data;
}

export const env = loadEnv();
