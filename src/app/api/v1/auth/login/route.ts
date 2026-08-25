import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { verifyCredentials } from "@/lib/auth/verify-credentials";
import { sendNewSignInEmail } from "@/lib/email/send";
import { signMobileToken } from "@/lib/mobile-auth/token";
import { getClientInfo } from "@/lib/request-info";

const BodySchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
  code: z.string().optional(),
});

/**
 * The native app's counterpart to the web sign-in form — same verifyCredentials (password +
 * lockout + 2FA) as src/auth.ts's Credentials provider, so a locked account or a required 2FA
 * code behaves identically on both surfaces. On success, mints a long-lived Bearer token (see
 * signMobileToken) instead of a browser session cookie — a native app has nowhere to keep a
 * cookie the way a browser does.
 */
export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const result = await verifyCredentials(parsed.data.email, parsed.data.password, parsed.data.code);

  switch (result.kind) {
    case "invalid_credentials":
      return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
    case "locked_out":
      return NextResponse.json(
        { error: "Too many failed attempts — try again in a few minutes." },
        { status: 401 },
      );
    case "two_factor_required":
      return NextResponse.json({ requiresTwoFactor: true, method: result.method }, { status: 200 });
    case "invalid_two_factor_code":
      return NextResponse.json({ error: "That code isn't right or has expired." }, { status: 401 });
    case "ok": {
      const token = await signMobileToken(result.user.id);
      // Same "new sign-in" notification email the web flow sends (see auth.ts's signIn
      // callback) — a mobile login is still a new session worth flagging to the account owner.
      const { ip, device } = await getClientInfo();
      await sendNewSignInEmail(result.user.email, {
        time: new Date().toUTCString(),
        device,
        ip,
        method: "Mobile app",
      }).catch((error) => console.error("[api/v1/auth/login] failed to send new-sign-in email", error));

      return NextResponse.json({ token, user: result.user });
    }
  }
}
