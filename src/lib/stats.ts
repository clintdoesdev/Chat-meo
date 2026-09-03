import { DEFAULT_TIME_ZONE, startOfDayInTimeZone } from "@/lib/timezone";

const DAY_MS = 86_400_000;

/** Buckets timestamps into daily counts for the trailing `days` window, oldest first — each
 * bucket a calendar day in `timeZone` (defaults to UTC when the caller has no client timezone to
 * pass), not a fixed 24h slice of server time. */
export function bucketByDay(dates: Date[], days: number, timeZone: string = DEFAULT_TIME_ZONE): number[] {
  const buckets = new Array(days).fill(0) as number[];
  const startOfToday = startOfDayInTimeZone(new Date(), timeZone).getTime();

  for (const date of dates) {
    const startOfDate = startOfDayInTimeZone(date, timeZone).getTime();
    const daysAgo = Math.round((startOfToday - startOfDate) / DAY_MS);
    const index = days - 1 - daysAgo;
    if (index >= 0 && index < days) buckets[index] += 1;
  }

  return buckets;
}

export type ChatsStartedBuckets = { today: number; yesterday: number; last7Days: number; last30Days: number };

/** Counts unique conversations (by their own createdAt, not their messages') started in each of
 * four windows: today and yesterday are discrete calendar days in `timeZone` (defaults to UTC
 * when the caller has no client timezone to pass — see src/lib/timezone.ts), while the 7- and
 * 30-day figures are trailing rolling windows that include today. A conversation counts once here
 * regardless of how many messages it holds — this is "chats started," not message volume. */
export function chatsStartedBuckets(dates: Date[], timeZone: string = DEFAULT_TIME_ZONE): ChatsStartedBuckets {
  const startOfToday = startOfDayInTimeZone(new Date(), timeZone).getTime();
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

/** Week-over-week trend of a *rate* (numerator/denominator per week), not a raw count —
 * weekOverWeekTrend(resolvedDates) alone would report how the count of resolved conversations
 * changed, which can swing wildly (and in the opposite direction of the rate itself) independent
 * of how the resolution RATE moved, since a busier week naturally resolves more conversations in
 * absolute terms even at a flat or falling rate. Null whenever either week had no conversations
 * to take a rate of, same "nothing to compare" convention as weekOverWeekTrend. */
export function weekOverWeekRateTrend(numeratorDates: Date[], denominatorDates: Date[]): Trend | null {
  const now = Date.now();
  const week = 7 * DAY_MS;

  const countInWindow = (dates: Date[], minAge: number, maxAge: number) =>
    dates.filter((date) => {
      const age = now - date.getTime();
      return age > minAge && age <= maxAge;
    }).length;

  const currentTotal = countInWindow(denominatorDates, 0, week);
  const previousTotal = countInWindow(denominatorDates, week, week * 2);
  if (currentTotal === 0 || previousTotal === 0) return null;

  const currentRate = countInWindow(numeratorDates, 0, week) / currentTotal;
  const previousRate = countInWindow(numeratorDates, week, week * 2) / previousTotal;

  if (previousRate === 0) {
    if (currentRate === 0) return null;
    return { percent: 100, direction: "up" };
  }

  const percent = Math.round(((currentRate - previousRate) / previousRate) * 100);
  if (percent === 0) return null;
  return { percent: Math.abs(percent), direction: percent > 0 ? "up" : "down" };
}
