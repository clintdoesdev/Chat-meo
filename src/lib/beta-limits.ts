/** Soft guardrails for the free beta — not billing, just enough to keep any one user from
 * accidentally (or not) running up LLM costs or spinning up dozens of bots. Both are
 * env-configurable so they can be tuned without a redeploy of the enforcement logic itself. */

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Messages per bot, per calendar month, before the widget starts replying with the beta-limit
 * message instead of running the flow. */
export const BETA_MESSAGE_CAP = envInt("BETA_MESSAGE_CAP", 500);

/** Bots per user, total (not monthly). */
export const BETA_BOT_CAP = envInt("BETA_BOT_CAP", 2);

export function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
