# SMM Referral Earnings Bot — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A Telegram bot enabling social media marketers and micro-influencers to register, earn $0.01 per valid referral via unique links, track referral stats in a dashboard, and request USDT (TRC20) withdrawals. Admins manage users, verify withdrawals, and monitor fraud.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- social media marketers
- micro-influencers

## Success criteria

- users earn $0.01 per valid referral with real-time balance updates
- withdrawal requests processed and admin-notified
- fraudulent referrals flagged and excluded from earnings

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Register new user or show dashboard for existing users
- **Copy referral link** (button, actor: user, callback: referral:copy) — Generate and copy unique referral link to clipboard
  - inputs: user.id, user.referral_code
  - outputs: referral_url
- **Withdraw Earnings** (button, actor: user, callback: withdraw:start) — Initiate USDT withdrawal request flow
  - inputs: user.balance
  - outputs: withdrawal_form
- **View Leaderboard** (button, actor: user, callback: leaderboard:view) — Display top 10 earners in referral program
  - inputs: user.stats
  - outputs: leaderboard_snapshot

## Flows

### registration
_Trigger:_ /start

1. detect new user
2. generate referral code
3. store user data
4. show dashboard

_Data touched:_ User

### referral_processing
_Trigger:_ referral link clicked

1. validate new user
2. create referral event
3. credit $0.01 to referrer
4. update referral stats
5. notify admin if flagged

_Data touched:_ User, ReferralEvent

### withdrawal_request
_Trigger:_ Withdraw Earnings button

1. validate balance threshold
2. collect USDT address
3. create withdrawal request
4. notify admin
5. update request status

_Data touched:_ WithdrawalRequest

### admin_management
_Trigger:_ admin authentication

1. view user list
2. review referrals
3. approve/deny withdrawals
4. flag fraudulent activity

_Data touched:_ User, ReferralEvent, WithdrawalRequest

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **User** _(retention: persistent)_ — Registered user with referral tracking and earnings
  - fields: id, username, balance, referral_code, stats
- **ReferralEvent** _(retention: persistent)_ — Record of referral relationship and validation status
  - fields: referrer, referee, timestamp, valid, flagged
- **WithdrawalRequest** _(retention: persistent)_ — Pending or completed withdrawal transaction
  - fields: user, amount, method, status, created_at, processed_at
- **AdminAction** _(retention: persistent)_ — Audit trail of admin interventions
  - fields: action_type, target, timestamp, notes

## Integrations

- **Telegram** (required) — Bot API messaging and notifications
- **USDT (TRC20)** (required) — Withdrawal processing
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- user management
- referral validation
- withdrawal approval
- fraud detection

## Notifications

- admin notified of new withdrawals via direct message
- admin alerted to flagged referrals
- users receive withdrawal status updates

## Permissions & privacy

- user data stored securely with access restricted to admins
- payment addresses encrypted
- referral data retained for audit purposes

## Edge cases

- self-referral attempts blocked
- duplicate account creation prevented
- withdrawal amounts outside $10-$500 range rejected
- flagged referrals excluded from earnings until cleared

## Required tests

- end-to-end referral crediting with balance update verification
- withdrawal request submission and admin approval workflow
- fraud detection triggers and admin review process

## Assumptions

- referral token appended to /start link as unique identifier
- USDT conversion handled by backend without user interaction
- admin @CHARLIES801 receives all critical alerts
