/** Soft guardrail for the free beta — not billing, just enough to keep any one bot from
 * accidentally (or not) running up LLM costs. Env-configurable so it can be tuned without a
 * redeploy of the enforcement logic itself. There's no longer a per-user bot-count cap: access
 * is closed-beta/invite-only now (see sign-in-card.tsx and auth.ts's Google signIn callback), so
 * that guardrail against strangers spinning up dozens of bots no longer applies. */

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Messages per bot, per calendar month, before the widget starts replying with the beta-limit
 * message instead of running the flow. */
export const BETA_MESSAGE_CAP = envInt("BETA_MESSAGE_CAP", 500);

export function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
