import { DEFAULT_TIME_ZONE, startOfMonthInTimeZone } from "@/lib/timezone";

/** Midnight on the 1st of the current month, in `timeZone` (defaults to UTC when the caller has
 * no client timezone to pass — see src/lib/timezone.ts). */
export function startOfCurrentMonth(timeZone: string = DEFAULT_TIME_ZONE): Date {
  return startOfMonthInTimeZone(new Date(), timeZone);
}
