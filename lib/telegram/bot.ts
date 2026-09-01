import "server-only";
import { Bot } from "grammy";
import { env } from "@/lib/env";
import { isAllowedTelegramId } from "@/lib/telegram/allowlist";
import { getBotSession } from "@/lib/repositories/botSessions";
import { getUserByTelegramId } from "@/lib/repositories/users";
import {
  ONBOARDING_FLOW,
  continueOnboarding,
  startOnboarding,
  type OnboardingState,
  type OnboardingStep,
} from "@/lib/telegram/onboarding";
import {
  MEAL_EDIT_FLOW,
  handleMealDraftCallback,
  handleMealEditReply,
  startMealAnalysis,
  startMealPhotoAnalysis,
  type MealDraftAction,
  type MealEditState,
} from "@/lib/telegram/mealDraft";
import { formatDailySummaryMessage, getDailySummary } from "@/lib/telegram/dailySummary";
import {
  downloadTelegramFileAsBase64,
  PhotoDownloadError,
} from "@/lib/telegram/photoDownload";

const HELP_MESSAGE =
  "Perintah yang tersedia:\n" +
  "/start - mulai atau lihat profil\n" +
  "/hariini - ringkasan kalori & makro hari ini\n" +
  "/help - bantuan\n\n" +
  "Untuk mencatat makan, langsung chat aja deskripsi makananmu (misal: \"nasi goreng ayam 1 piring\"), " +
  "atau kirim foto piring makananmu / label info nilai gizi kemasan.\n\n" +
  "Fitur air minum, olahraga, dan reminder akan segera hadir.";

const MEAL_CALLBACK_PATTERN = /^meal:([0-9a-f-]{36}):(dec|inc|edit|save|cancel)$/;

function createBot(): Bot {
  const instance = new Bot(env.TELEGRAM_BOT_TOKEN);

  // Allowlist check runs first, before any other (expensive) processing.
  instance.use(async (ctx, next) => {
    const telegramId = ctx.from?.id;
    if (telegramId === undefined || !isAllowedTelegramId(telegramId)) {
      return;
    }
    await next();
  });

  instance.command("help", async (ctx) => {
    await ctx.reply(HELP_MESSAGE);
  });

  instance.command("start", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (telegramId === undefined) return;
    await startOnboarding(ctx, telegramId);
  });

  instance.command("hariini", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (telegramId === undefined) return;

    const user = await getUserByTelegramId(telegramId);
    if (!user?.onboardingCompleted) {
      await ctx.reply("Yuk mulai dulu dengan /start supaya aku kenal kamu.");
      return;
    }

    const summary = await getDailySummary(telegramId, user.timezone);
    await ctx.reply(formatDailySummaryMessage(summary));
  });

  instance.on("callback_query:data", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (telegramId === undefined) return;

    const match = MEAL_CALLBACK_PATTERN.exec(ctx.callbackQuery.data);
    if (!match) {
      await ctx.answerCallbackQuery();
      return;
    }

    const user = await getUserByTelegramId(telegramId);
    if (!user?.onboardingCompleted) {
      await ctx.answerCallbackQuery();
      return;
    }

    const [, draftId, action] = match;
    await handleMealDraftCallback(
      ctx,
      telegramId,
      draftId,
      action as MealDraftAction,
      user
    );
  });

  instance.on("message:photo", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (telegramId === undefined) return;

    const user = await getUserByTelegramId(telegramId);
    if (!user?.onboardingCompleted) {
      await ctx.reply("Yuk mulai dulu dengan /start supaya aku kenal kamu.");
      return;
    }

    await ctx.replyWithChatAction("typing");

    const file = await ctx.getFile();
    if (!file.file_path) {
      await ctx.reply("Maaf, aku gagal mengambil foto itu. Coba kirim ulang ya.");
      return;
    }

    let imageBase64: string;
    try {
      imageBase64 = await downloadTelegramFileAsBase64(file.file_path);
    } catch (error) {
      if (!(error instanceof PhotoDownloadError)) throw error;
      await ctx.reply(
        "Maaf, foto itu gagal diproses (mungkin terlalu besar). Coba kirim foto lain ya."
      );
      return;
    }

    await startMealPhotoAnalysis(ctx, telegramId, imageBase64, "image/jpeg");
  });

  instance.on("message:text", async (ctx) => {
    const telegramId = ctx.from?.id;
    if (telegramId === undefined) return;
    const text = ctx.message.text;

    const session = await getBotSession<OnboardingState | MealEditState>(telegramId);

    if (session?.flow === ONBOARDING_FLOW) {
      await continueOnboarding(
        ctx,
        telegramId,
        session.step as OnboardingStep,
        session.state as OnboardingState,
        text
      );
      return;
    }

    if (session?.flow === MEAL_EDIT_FLOW) {
      const { draftId } = session.state as MealEditState;
      await handleMealEditReply(ctx, telegramId, draftId, text);
      return;
    }

    const user = await getUserByTelegramId(telegramId);
    if (!user?.onboardingCompleted) {
      await ctx.reply("Yuk mulai dulu dengan /start supaya aku kenal kamu.");
      return;
    }

    if (text.startsWith("/")) {
      await ctx.reply("Perintah tidak dikenal. Ketik /help untuk lihat perintah yang ada.");
      return;
    }

    await startMealAnalysis(ctx, telegramId, text);
  });

  return instance;
}

let bot: Bot | null = null;
let initialized: Promise<void> | null = null;

function getBot(): Bot {
  if (!bot) bot = createBot();
  return bot;
}

/**
 * Returns the bot after ensuring `bot.init()` has run. `init()` fetches the
 * bot's own identity from Telegram; caching the promise means it only
 * happens once per warm serverless instance instead of on every request.
 */
export async function getInitializedBot(): Promise<Bot> {
  const instance = getBot();
  if (!initialized) {
    initialized = instance.init();
  }
  await initialized;
  return instance;
}
