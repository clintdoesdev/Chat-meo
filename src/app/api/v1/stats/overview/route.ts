import { NextResponse, type NextRequest } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth/token";
import { getOverviewStatsForUser } from "@/lib/stats-queries";
import { normalizeTimeZone } from "@/lib/timezone";

/** Mobile's equivalent of the web Overview page's stat cards (src/app/(main)/app/page.tsx) —
 * same getOverviewStatsForUser query, so the two dashboards can never disagree on a number.
 * `tz` is the device's own IANA timezone (see mobile/src/lib/api/endpoints.ts's getOverviewStats)
 * so "Today"/"Yesterday" line up with the phone's own midnight rather than the server's. */
export async function GET(request: NextRequest) {
  const userId = await requireMobileUser(request);
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const timeZone = normalizeTimeZone(request.nextUrl.searchParams.get("tz"));
  const stats = await getOverviewStatsForUser(userId, timeZone);
  return NextResponse.json(stats);
}
