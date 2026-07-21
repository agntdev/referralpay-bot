import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { getUser, createWithdrawalRequest, type WithdrawalRequest } from "../storage.js";

const composer = new Composer<Ctx>();

const MIN_WITHDRAWAL = 10;
const MAX_WITHDRAWAL = 500;

// Admin IDs - set via environment variable
const getAdminIds = (): number[] => {
  const envIds = process.env.ADMIN_IDS;
  if (envIds) {
    return envIds.split(",").map((id) => parseInt(id.trim(), 10)).filter((id) => !isNaN(id));
  }
  return [];
};

composer.callbackQuery("withdraw:start", async (ctx) => {
  await ctx.answerCallbackQuery();
  
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply("Please start the bot first with /start", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  const user = await getUser(userId);
  if (!user) {
    await ctx.reply("Please start the bot first with /start", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  // Check balance threshold
  if (user.balance < MIN_WITHDRAWAL) {
    await ctx.reply(
      `Your balance is $${user.balance.toFixed(2)}. Minimum withdrawal is $${MIN_WITHDRAWAL}. Keep earning!`,
      {
        reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
      }
    );
    return;
  }

  // Show withdrawal form
  await ctx.reply(
    `💰 Withdrawal Request\n\nYour balance: $${user.balance.toFixed(2)}\n\nPlease enter your USDT TRC20 wallet address:`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("❌ Cancel", "withdraw:cancel")],
      ]),
    }
  );
});

// Handle wallet address input
composer.on("message:text", async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId) {
    await next();
    return;
  }

  // Check if this is a wallet address (simple validation)
  const text = ctx.message.text;
  
  // Only process if it looks like a TRC20 address (starts with T and is 34 chars)
  if (!text.startsWith("T") || text.length !== 34) {
    await next();
    return;
  }

  const user = await getUser(userId);
  if (!user) {
    await next();
    return;
  }

  // Create withdrawal request
  const requestId = `WD${Date.now()}`;
  const request: WithdrawalRequest = {
    id: requestId,
    user: userId,
    amount: user.balance,
    method: "USDT TRC20",
    wallet_address: text,
    status: "pending",
    created_at: Date.now(),
  };

  await createWithdrawalRequest(request);

  // Update user balance
  user.balance = 0;
  await (await import("../storage.js")).setUser(user);

  // Notify admins
  const adminIds = getAdminIds();
  for (const adminId of adminIds) {
    try {
      await ctx.api.sendMessage(
        adminId,
        `💸 New Withdrawal Request\n\nUser: ${ctx.from?.username ? `@${ctx.from.username}` : `User ${userId}`}\nAmount: $${request.amount.toFixed(2)}\nWallet: ${text}\n\nReview in admin panel.`
      );
    } catch (error) {
      // Admin might not have started the bot - ignore error
    }
  }

  await ctx.reply(
    `✅ Withdrawal request submitted!\n\nAmount: $${request.amount.toFixed(2)}\nWallet: ${text}\nStatus: Pending\n\nYou'll be notified when your withdrawal is processed.`,
    {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    }
  );
});

// Cancel withdrawal
composer.callbackQuery("withdraw:cancel", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Withdrawal cancelled.", {
    reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
  });
});

export default composer;
