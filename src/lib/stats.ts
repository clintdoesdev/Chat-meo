const DAY_MS = 86_400_000;

/** Buckets timestamps into daily counts for the trailing `days` window, oldest first. */
export function bucketByDay(dates: Date[], days: number): number[] {
  const buckets = new Array(days).fill(0) as number[];
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();

  for (const date of dates) {
    const startOfDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    ).getTime();
    const daysAgo = Math.round((startOfToday - startOfDate) / DAY_MS);
    const index = days - 1 - daysAgo;
    if (index >= 0 && index < days) buckets[index] += 1;
  }

  return buckets;
}

export type ChatsStartedBuckets = { today: number; yesterday: number; last7Days: number; last30Days: number };

/** Counts unique conversations (by their own createdAt, not their messages') started in each of
 * four windows: today and yesterday are discrete UTC calendar days (same UTC-day convention as
 * startOfCurrentMonth in date-utils.ts), while the 7- and 30-day figures are trailing rolling
 * windows that include today. A conversation counts once here regardless of how many messages
 * it holds — this is "chats started," not message volume. */
export function chatsStartedBuckets(dates: Date[]): ChatsStartedBuckets {
  const now = new Date();
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const startOfYesterday = startOfToday - DAY_MS;
  const sevenDayWindowStart = startOfToday - 6 * DAY_MS;
  const thirtyDayWindowStart = startOfToday - 29 * DAY_MS;

  let today = 0;
  let yesterday = 0;
  let last7Days = 0;
  let last30Days = 0;

  for (const date of dates) {
    const time = date.getTime();
    if (time >= startOfToday) today += 1;
    if (time >= startOfYesterday && time < startOfToday) yesterday += 1;
    if (time >= sevenDayWindowStart) last7Days += 1;
    if (time >= thirtyDayWindowStart) last30Days += 1;
  }

  return { today, yesterday, last7Days, last30Days };
}

export type Trend = { percent: number; direction: "up" | "down" };

/** Compares the trailing 7 days against the 7 days before that. Null when there's nothing to compare. */
export function weekOverWeekTrend(dates: Date[]): Trend | null {
  const now = Date.now();
  const week = 7 * DAY_MS;

  let current = 0;
  let previous = 0;
  for (const date of dates) {
    const age = now - date.getTime();
    if (age <= week) current += 1;
    else if (age <= week * 2) previous += 1;
  }

  if (previous === 0) {
    if (current === 0) return null;
    return { percent: 100, direction: "up" };
  }

  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) return null;
  return { percent: Math.abs(percent), direction: percent > 0 ? "up" : "down" };
}
