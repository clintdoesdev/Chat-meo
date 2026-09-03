// Every "which day is this" boundary in the Overview stats (src/lib/stats.ts,
// src/lib/date-utils.ts) used to be anchored to the server's own clock — UTC in production,
// wherever this app happens to be hosted — instead of the person actually looking at the
// dashboard. A seller several hours off UTC would see "Today" roll over hours before or after
// their own midnight, misfiling messages sent right after their local midnight into "yesterday"
// (or the reverse). These helpers let every day-boundary calculation be anchored to whatever IANA
// timezone the caller (a browser, a phone) reports for itself instead.

export const DEFAULT_TIME_ZONE = "UTC";

/** True when `timeZone` is a real IANA zone name Intl can resolve — guards against a garbled
 * client-supplied string (a cookie, a query param) reaching Intl.DateTimeFormat, which throws on
 * anything it doesn't recognize. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Falls back to DEFAULT_TIME_ZONE for anything missing or invalid, so every caller below stays
 * correct (if UTC-anchored) even for a request that never told us its timezone at all — an old
 * mobile build, a bot, a client with cookies/JS disabled. */
export function normalizeTimeZone(timeZone: string | null | undefined): string {
  if (timeZone && isValidTimeZone(timeZone)) return timeZone;
  return DEFAULT_TIME_ZONE;
}

function zonedParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

/** The real UTC instant that `timeZone`'s own local midnight fell on, for whatever calendar date
 * `instant` happens to be on there — the building block every "what day is it right now, for
 * this person" boundary needs. Re-derives the zone's current UTC offset from `instant` itself
 * (rather than assuming a fixed one), so a DST transition on the day in question is handled
 * correctly too. */
export function startOfDayInTimeZone(instant: Date, timeZone: string): Date {
  // formatToParts only has whole-second resolution — truncating `instant` to match before diffing
  // keeps the offset computation exact. A real IANA offset is always a whole number of minutes,
  // so without this, instant's own sub-second remainder would leak straight into the returned
  // "midnight" (off by up to 999ms), which is harmless for the day-bucket math in stats.ts but not
  // for an exact-boundary comparison like chatsStartedBuckets' `time >= startOfYesterday`.
  const truncatedMs = Math.floor(instant.getTime() / 1000) * 1000;
  const { year, month, day, hour, minute, second } = zonedParts(new Date(truncatedMs), timeZone);
  const wallClockAsUTC = Date.UTC(year, month - 1, day, hour, minute, second);
  const offsetMs = wallClockAsUTC - truncatedMs;
  const localMidnightAsUTC = Date.UTC(year, month - 1, day);
  return new Date(localMidnightAsUTC - offsetMs);
}

/** Same idea as startOfDayInTimeZone, but for the 1st of the month (see
 * stats-queries.ts's messagesThisMonth) — anchored at noon UTC on the 1st first (safely clear of
 * any DST transition boundary) so the offset gets computed for that actual day, not for `instant`
 * possibly weeks later in a different DST state. */
export function startOfMonthInTimeZone(instant: Date, timeZone: string): Date {
  const { year, month } = zonedParts(instant, timeZone);
  const noonOnFirst = new Date(Date.UTC(year, month - 1, 1, 12));
  return startOfDayInTimeZone(noonOnFirst, timeZone);
}
