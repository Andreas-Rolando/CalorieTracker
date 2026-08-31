export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 text-center font-sans dark:bg-black">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
        CalorieTracker AI Bot
      </h1>
      <p className="mt-2 max-w-md text-zinc-600 dark:text-zinc-400">
        This is the backend for a personal Telegram calorie tracker bot. It
        has no public UI — use the Telegram bot, or your personal dashboard
        link if you have one.
      </p>
    </div>
  );
}
