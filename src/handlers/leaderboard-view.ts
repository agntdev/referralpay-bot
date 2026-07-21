import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getLeaderboard } from "../storage.js";

const composer = new Composer<Ctx>();

composer.callbackQuery("leaderboard:view", async (ctx) => {
  await ctx.answerCallbackQuery();
  
  const leaderboard = await getLeaderboard(10);
  
  if (leaderboard.length === 0) {
    await ctx.reply(
      "🏆 Leaderboard\n\nNo referrals yet. Be the first to earn!",
      {
        reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
      }
    );
    return;
  }

  // Format leaderboard
  const lines = leaderboard.map((user, index) => {
    const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
    const name = user.username ? `@${user.username}` : `User ${user.id}`;
    return `${medal} ${name} — $${user.stats.total_earned.toFixed(2)}`;
  });

  await ctx.reply(
    `🏆 Top 10 Earners\n\n${lines.join("\n")}`,
    {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    }
  );
});

export default composer;
