import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import {
  getAllUsers,
  getPendingWithdrawals,
  getWithdrawalRequest,
  updateWithdrawalRequest,
  createAdminAction,
} from "../storage.js";

// Admin user IDs - set via environment variable or config
const getAdminIds = (): number[] => {
  const envIds = process.env.ADMIN_IDS;
  if (envIds) {
    return envIds.split(",").map((id) => parseInt(id.trim(), 10)).filter((id) => !isNaN(id));
  }
  return [];
};

const composer = new Composer<Ctx>();

// Check if user is admin
function isAdmin(userId: number): boolean {
  return getAdminIds().includes(userId);
}

// Admin menu
composer.callbackQuery("admin:menu", async (ctx) => {
  await ctx.answerCallbackQuery();
  
  if (!ctx.from?.id || !isAdmin(ctx.from.id)) {
    await ctx.reply("⛔ Access denied. Admin only.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  await ctx.reply(
    "🔧 Admin Panel\n\nSelect an option:",
    {
      reply_markup: inlineKeyboard([
        [inlineButton("👥 View Users", "admin:users")],
        [inlineButton("💸 Pending Withdrawals", "admin:withdrawals")],
        [inlineButton("📊 Referral Stats", "admin:stats")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    }
  );
});

// View users
composer.callbackQuery("admin:users", async (ctx) => {
  await ctx.answerCallbackQuery();
  
  if (!ctx.from?.id || !isAdmin(ctx.from.id)) {
    await ctx.reply("⛔ Access denied. Admin only.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  const users = await getAllUsers();
  
  if (users.length === 0) {
    await ctx.reply(
      "👥 Users\n\nNo users registered yet.",
      {
        reply_markup: inlineKeyboard([[inlineButton("⬅️ Back", "admin:menu")]]),
      }
    );
    return;
  }

  // Show first 10 users
  const lines = users.slice(0, 10).map((user) => {
    const name = user.username ? `@${user.username}` : `User ${user.id}`;
    return `• ${name} — $${user.balance.toFixed(2)} balance, ${user.stats.total_referrals} referrals`;
  });

  await ctx.reply(
    `👥 Users (${users.length} total)\n\n${lines.join("\n")}`,
    {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back", "admin:menu")]]),
    }
  );
});

// View pending withdrawals
composer.callbackQuery("admin:withdrawals", async (ctx) => {
  await ctx.answerCallbackQuery();
  
  if (!ctx.from?.id || !isAdmin(ctx.from.id)) {
    await ctx.reply("⛔ Access denied. Admin only.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  const withdrawals = await getPendingWithdrawals();
  
  if (withdrawals.length === 0) {
    await ctx.reply(
      "💸 Pending Withdrawals\n\nNo pending withdrawals.",
      {
        reply_markup: inlineKeyboard([[inlineButton("⬅️ Back", "admin:menu")]]),
      }
    );
    return;
  }

  // Show first 5 pending withdrawals
  const lines = withdrawals.slice(0, 5).map((w) => {
    return `• $${w.amount.toFixed(2)} to ${w.wallet_address.slice(0, 10)}...`;
  });

  await ctx.reply(
    `💸 Pending Withdrawals (${withdrawals.length} total)\n\n${lines.join("\n")}`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("Review All", "admin:review_withdrawals")],
        [inlineButton("⬅️ Back", "admin:menu")],
      ]),
    }
  );
});

// Review withdrawals
composer.callbackQuery("admin:review_withdrawals", async (ctx) => {
  await ctx.answerCallbackQuery();
  
  if (!ctx.from?.id || !isAdmin(ctx.from.id)) {
    await ctx.reply("⛔ Access denied. Admin only.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  const withdrawals = await getPendingWithdrawals();
  
  if (withdrawals.length === 0) {
    await ctx.reply(
      "💸 Review Withdrawals\n\nNo pending withdrawals to review.",
      {
        reply_markup: inlineKeyboard([[inlineButton("⬅️ Back", "admin:menu")]]),
      }
    );
    return;
  }

  // Show first pending withdrawal
  const w = withdrawals[0];
  await ctx.reply(
    `💸 Review Withdrawal\n\nAmount: $${w.amount.toFixed(2)}\nWallet: ${w.wallet_address}\nUser: ${w.user}`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("✅ Approve", `admin:approve:${w.id}`)],
        [inlineButton("❌ Deny", `admin:deny:${w.id}`)],
        [inlineButton("⬅️ Back", "admin:menu")],
      ]),
    }
  );
});

// Approve withdrawal
composer.callbackQuery(/^admin:approve:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  
  if (!ctx.from?.id || !isAdmin(ctx.from.id)) {
    await ctx.reply("⛔ Access denied. Admin only.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  const match = ctx.match;
  if (!match) return;
  
  const withdrawalId = match[1];
  const withdrawal = await getPendingWithdrawals().then(
    (w) => w.find((w) => w.id === withdrawalId)
  );

  if (!withdrawal) {
    await ctx.reply("Withdrawal not found.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back", "admin:menu")]]),
    });
    return;
  }

  // Update withdrawal status
  withdrawal.status = "approved";
  withdrawal.processed_at = Date.now();
  await updateWithdrawalRequest(withdrawal);

  // Log admin action
  await createAdminAction({
    action_type: "approve_withdrawal",
    target: withdrawal.user,
    admin: ctx.from.id,
    timestamp: Date.now(),
    notes: `Approved withdrawal of $${withdrawal.amount.toFixed(2)}`,
  });

  // Notify user
  try {
    await ctx.api.sendMessage(
      withdrawal.user,
      `✅ Withdrawal Approved\n\nYour withdrawal of $${withdrawal.amount.toFixed(2)} has been approved and will be processed shortly.`
    );
  } catch (error) {
    // User might not have started the bot - ignore error
  }

  await ctx.editMessageText(
    `✅ Withdrawal Approved\n\nAmount: $${withdrawal.amount.toFixed(2)}\nWallet: ${withdrawal.wallet_address}\nStatus: Approved`,
    {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back", "admin:menu")]]),
    }
  );
});

// Deny withdrawal
composer.callbackQuery(/^admin:deny:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  
  if (!ctx.from?.id || !isAdmin(ctx.from.id)) {
    await ctx.reply("⛔ Access denied. Admin only.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  const match = ctx.match;
  if (!match) return;
  
  const withdrawalId = match[1];
  const withdrawal = await getPendingWithdrawals().then(
    (w) => w.find((w) => w.id === withdrawalId)
  );

  if (!withdrawal) {
    await ctx.reply("Withdrawal not found.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back", "admin:menu")]]),
    });
    return;
  }

  // Update withdrawal status
  withdrawal.status = "denied";
  withdrawal.processed_at = Date.now();
  await updateWithdrawalRequest(withdrawal);

  // Log admin action
  await createAdminAction({
    action_type: "deny_withdrawal",
    target: withdrawal.user,
    admin: ctx.from.id,
    timestamp: Date.now(),
    notes: `Denied withdrawal of $${withdrawal.amount.toFixed(2)}`,
  });

  // Notify user
  try {
    await ctx.api.sendMessage(
      withdrawal.user,
      `❌ Withdrawal Denied\n\nYour withdrawal of $${withdrawal.amount.toFixed(2)} has been denied. Please contact support for more information.`
    );
  } catch (error) {
    // User might not have started the bot - ignore error
  }

  await ctx.editMessageText(
    `❌ Withdrawal Denied\n\nAmount: $${withdrawal.amount.toFixed(2)}\nWallet: ${withdrawal.wallet_address}\nStatus: Denied`,
    {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back", "admin:menu")]]),
    }
  );
});

// View referral stats
composer.callbackQuery("admin:stats", async (ctx) => {
  await ctx.answerCallbackQuery();
  
  if (!ctx.from?.id || !isAdmin(ctx.from.id)) {
    await ctx.reply("⛔ Access denied. Admin only.", {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]),
    });
    return;
  }

  const users = await getAllUsers();
  const totalUsers = users.length;
  const totalBalance = users.reduce((sum, u) => sum + u.balance, 0);
  const totalReferrals = users.reduce((sum, u) => sum + u.stats.total_referrals, 0);
  const totalEarnings = users.reduce((sum, u) => sum + u.stats.total_earned, 0);

  await ctx.reply(
    `📊 Referral Stats\n\nTotal users: ${totalUsers}\nTotal referrals: ${totalReferrals}\nTotal earned: $${totalEarnings.toFixed(2)}\nTotal balance: $${totalBalance.toFixed(2)}`,
    {
      reply_markup: inlineKeyboard([[inlineButton("⬅️ Back", "admin:menu")]]),
    }
  );
});

export default composer;
