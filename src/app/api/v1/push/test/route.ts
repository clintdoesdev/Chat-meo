import { NextResponse, type NextRequest } from "next/server";
import { requireMobileUser } from "@/lib/mobile-auth/token";
import { sendTestPush } from "@/lib/push/send";

/** Fires a real test push through both channels (FCM + web push) for the signed-in user and
 * returns exactly what each one did — see sendTestPush's doc comment. Exists because a "not
 * working" report from a real device with no server-log access can't otherwise be told apart
 * from "not registered," "registered but the send failed," or "sent fine, just not displayed." */
export async function GET(request: NextRequest) {
  const userId = await requireMobileUser(request);
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const diagnostics = await sendTestPush(userId);
  return NextResponse.json(diagnostics);
}
