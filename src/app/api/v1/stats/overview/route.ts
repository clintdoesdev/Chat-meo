import { NextResponse, type NextRequest } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth/token";
import { getOverviewStatsForUser } from "@/lib/stats-queries";

/** Mobile's equivalent of the web Overview page's stat cards (src/app/(main)/app/page.tsx) —
 * same getOverviewStatsForUser query, so the two dashboards can never disagree on a number. */
export async function GET(request: NextRequest) {
  const userId = await requireMobileUser(request);
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const stats = await getOverviewStatsForUser(userId);
  return NextResponse.json(stats);
}
