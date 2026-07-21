import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

const HELP =
  "ℹ️ How to use this bot:\n\n" +
  "1️⃣ Tap /start to open the menu\n" +
  "2️⃣ Get your referral link and share it\n" +
  "3️⃣ Earn $0.01 for each valid referral\n" +
  "4️⃣ Withdraw your earnings via USDT (TRC20)\n\n" +
  "Everything is button-driven — just tap to navigate!";

const backToMenu = inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);

composer.command("help", async (ctx) => {
  await ctx.reply(HELP);
});

composer.callbackQuery("menu:help", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(HELP, { reply_markup: backToMenu });
});

export default composer;
