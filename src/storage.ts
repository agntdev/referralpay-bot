import type { StorageAdapter } from "grammy";

/**
 * Durable data storage for the bot.
 * Uses the same StorageAdapter interface as grammY sessions,
 * but for domain data (users, referrals, withdrawals, admin actions).
 * In production, backed by Redis. In test harness, uses in-memory.
 */

export interface User {
  id: number;
  username?: string;
  balance: number;
  referral_code: string;
  stats: {
    total_referrals: number;
    valid_referrals: number;
    flagged_referrals: number;
    total_earned: number;
  };
  created_at: number;
}

export interface ReferralEvent {
  referrer: number;
  referee: number;
  timestamp: number;
  valid: boolean;
  flagged: boolean;
}

export interface WithdrawalRequest {
  id: string;
  user: number;
  amount: number;
  method: string;
  wallet_address: string;
  status: "pending" | "approved" | "denied";
  created_at: number;
  processed_at?: number;
}

export interface AdminAction {
  action_type: string;
  target: number | string;
  admin: number;
  timestamp: number;
  notes: string;
}

// In-memory store for development/testing
// In production, this would be Redis-backed
const store = new Map<string, unknown>();

function getKey(prefix: string, id: string | number): string {
  return `${prefix}:${id}`;
}

// User operations
export async function getUser(userId: number): Promise<User | undefined> {
  return store.get(getKey("user", userId)) as User | undefined;
}

export async function setUser(user: User): Promise<void> {
  store.set(getKey("user", user.id), user);
}

export async function getAllUsers(): Promise<User[]> {
  const users: User[] = [];
  for (const [key, value] of store.entries()) {
    if (key.startsWith("user:")) {
      users.push(value as User);
    }
  }
  return users;
}

export async function getUserByReferralCode(code: string): Promise<User | undefined> {
  for (const [key, value] of store.entries()) {
    if (key.startsWith("user:")) {
      const user = value as User;
      if (user.referral_code === code) {
        return user;
      }
    }
  }
  return undefined;
}

// Referral operations
export async function createReferralEvent(event: ReferralEvent): Promise<void> {
  store.set(getKey("referral", `${event.referrer}:${event.referee}`), event);
}

export async function getReferralEvents(referrer: number): Promise<ReferralEvent[]> {
  const events: ReferralEvent[] = [];
  for (const [key, value] of store.entries()) {
    if (key.startsWith("referral:")) {
      const event = value as ReferralEvent;
      if (event.referrer === referrer) {
        events.push(event);
      }
    }
  }
  return events;
}

export async function getAllReferralEvents(): Promise<ReferralEvent[]> {
  const events: ReferralEvent[] = [];
  for (const [key, value] of store.entries()) {
    if (key.startsWith("referral:")) {
      events.push(value as ReferralEvent);
    }
  }
  return events;
}

// Withdrawal operations
export async function createWithdrawalRequest(request: WithdrawalRequest): Promise<void> {
  store.set(getKey("withdrawal", request.id), request);
}

export async function getWithdrawalRequest(id: string): Promise<WithdrawalRequest | undefined> {
  return store.get(getKey("withdrawal", id)) as WithdrawalRequest | undefined;
}

export async function getUserWithdrawals(userId: number): Promise<WithdrawalRequest[]> {
  const requests: WithdrawalRequest[] = [];
  for (const [key, value] of store.entries()) {
    if (key.startsWith("withdrawal:")) {
      const request = value as WithdrawalRequest;
      if (request.user === userId) {
        requests.push(request);
      }
    }
  }
  return requests;
}

export async function getPendingWithdrawals(): Promise<WithdrawalRequest[]> {
  const requests: WithdrawalRequest[] = [];
  for (const [key, value] of store.entries()) {
    if (key.startsWith("withdrawal:")) {
      const request = value as WithdrawalRequest;
      if (request.status === "pending") {
        requests.push(request);
      }
    }
  }
  return requests;
}

export async function updateWithdrawalRequest(request: WithdrawalRequest): Promise<void> {
  store.set(getKey("withdrawal", request.id), request);
}

// Admin action operations
export async function createAdminAction(action: AdminAction): Promise<void> {
  store.set(getKey("admin_action", `${action.admin}:${action.timestamp}`), action);
}

// Leaderboard operations
export async function getLeaderboard(limit: number = 10): Promise<User[]> {
  const users = await getAllUsers();
  return users
    .sort((a, b) => b.stats.total_earned - a.stats.total_earned)
    .slice(0, limit);
}

// Referral code generation
export function generateReferralCode(userId: number): string {
  return `REF${userId.toString(36).toUpperCase()}`;
}

// Clear store (for testing)
export function clearStore(): void {
  store.clear();
}
