"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const COOKIE_NAME = "tz";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Keeps a `tz` cookie in sync with the browser's own IANA timezone so Server Components — the
 * Overview page's stat queries, in particular (see src/lib/timezone.ts) — can anchor
 * "Today"/"Yesterday" to the viewer's own midnight instead of wherever this app happens to be
 * hosted. Refreshes the current route once when the cookie is missing or stale (a new browser, a
 * changed device timezone) so the already-rendered page picks up the corrected value right away
 * instead of waiting for the next natural navigation. */
export function TimezoneSync() {
  const router = useRouter();

  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timeZone || readCookie(COOKIE_NAME) === timeZone) return;
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(timeZone)}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
    router.refresh();
  }, [router]);

  return null;
}
