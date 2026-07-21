import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  mainMenuKeyboard,
  inlineButton,
  registerMainMenuItem,
} from "../toolkit/index.js";
import {
  getUser,
  setUser,
  generateReferralCode,
  createReferralEvent,
  getUserByReferralCode,
} from "../storage.js";

// Register main menu items
registerMainMenuItem({
  label: "🔗 Referral Link",
  data: "referral:copy",
  order: 10,
});

registerMainMenuItem({
  label: "💰 Withdraw",
  data: "withdraw:start",
  order: 20,
});

registerMainMenuItem({
  label: "🏆 Leaderboard",
  data: "leaderboard:view",
  order: 30,
});

// Admin IDs - set via environment variable
const getAdminIds = (): number[] => {
  const envIds = process.env.ADMIN_IDS;
  if (envIds) {
    return envIds.split(",").map((id) => parseInt(id.trim(), 10)).filter((id) => !isNaN(id));
  }
  return [];
};

const composer = new Composer<Ctx>();

const WELCOME = "👋 Welcome! Tap a button below to get started.";

composer.command("start", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  // Extract referral code from deep link: /start REF123
  const text = ctx.message?.text ?? "";
  const startParam = text.length > 7 ? text.slice(7).trim() : undefined;
  
  // Check if user exists
  let user = await getUser(userId);

  if (!user) {
    // New user - register them
    const referralCode = generateReferralCode(userId);
    user = {
      id: userId,
      username: ctx.from?.username,
      balance: 0,
      referral_code: referralCode,
      stats: {
        total_referrals: 0,
        valid_referrals: 0,
        flagged_referrals: 0,
        total_earned: 0,
      },
      created_at: Date.now(),
    };
    await setUser(user);

    // Process referral if start param exists and is a valid referral code
    if (startParam && startParam !== referralCode) {
      const referrer = await getUserByReferralCode(startParam);
      if (referrer && referrer.id !== userId) {
        // Valid referral - credit $0.01 to referrer
        referrer.balance += 0.01;
        referrer.stats.total_referrals += 1;
        referrer.stats.valid_referrals += 1;
        referrer.stats.total_earned += 0.01;
        await setUser(referrer);

        // Create referral event
        await createReferralEvent({
          referrer: referrer.id,
          referee: userId,
          timestamp: Date.now(),
          valid: true,
          flagged: false,
        });
      }
    }
  }

  // Show dashboard with main menu
  // Add admin button for admins
  const isAdmin = getAdminIds().includes(userId);
  const keyboard = mainMenuKeyboard();
  
  if (isAdmin) {
    // Add admin button to the keyboard
    keyboard.inline_keyboard.push([
      inlineButton("🔧 Admin", "admin:menu"),
    ]);
  }

  await ctx.reply(WELCOME, { reply_markup: keyboard });
});

// "Back to menu" — re-render the main menu in place from any sub-view.
composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(WELCOME, { reply_markup: mainMenuKeyboard() });
});

export default composer;
