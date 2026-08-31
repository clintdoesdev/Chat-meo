import { parsePhoneNumberFromString } from "libphonenumber-js";

/** WhatsApp's visitorId is the customer's raw E.164 digits with no leading "+" (e.g.
 * "2349035162263") — fine for matching against the API, unreadable as a label. Renders it as
 * "+234 903 516 2263" when it parses as a real number; falls back to the raw string otherwise
 * (a WEB-channel visitorId is a generated id, not a phone number, so parsing is expected to fail
 * for it — callers should only pass this a WhatsApp visitorId). */
export function formatPhoneNumber(raw: string): string {
  const parsed = parsePhoneNumberFromString(`+${raw.replace(/^\+/, "")}`);
  return parsed?.isValid() ? parsed.formatInternational() : raw;
}
