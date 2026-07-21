import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getUser } from "../storage.js";

const composer = new Composer<Ctx>();

const backToMenu = inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);

composer.callbackQuery("referral:copy", async (ctx) => {
  await ctx.answerCallbackQuery();
  
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply("Please start the bot first with /start", {
      reply_markup: backToMenu,
    });
    return;
  }

  const user = await getUser(userId);
  if (!user) {
    await ctx.reply("Please start the bot first with /start", {
      reply_markup: backToMenu,
    });
    return;
  }

  // Generate the referral link
  const botUsername = ctx.me?.username || "your_bot";
  const referralUrl = `https://t.me/${botUsername}?start=${user.referral_code}`;

  await ctx.editMessageText(
    `🔗 Your referral link:\n\n${referralUrl}\n\nShare this link with friends. You earn $0.01 for each valid referral!`,
    {
      reply_markup: backToMenu,
    }
  );
});

export default composer;
