import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sendTestPush } from "@/lib/push/send";

/** Web counterpart to /api/v1/push/test — same diagnostic, session-authenticated instead of
 * Bearer, called from PushSubscriptionToggle's "Send test notification" row. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const diagnostics = await sendTestPush(session.user.id);
  return NextResponse.json(diagnostics);
}
