"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email/send";
import { issueVerificationCode, verifyCode } from "@/lib/otp";

type ActionResult = { error: string | null; ok?: boolean };

// Scoped to the signed-in session (not an email param) so this can't be used
// to probe verification state for other accounts.
export async function verifyEmailCode(code: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Sign in to verify your email." };
  }

  const result = await verifyCode(session.user.id, "EMAIL_VERIFY", code);

  if (result === "ok") {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { emailVerified: new Date() },
    });
    return { error: null, ok: true };
  }

  if (result === "expired") {
    return { error: "That code expired. Request a new one." };
  }
  if (result === "locked") {
    return { error: "Too many attempts. Request a new code." };
  }
  return { error: "That code isn't right." };
}

export async function resendVerificationCode(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return { error: "Sign in to verify your email." };
  }

  const code = await issueVerificationCode(session.user.id, "EMAIL_VERIFY");
  if (code) {
    await sendVerificationEmail(session.user.email, code);
  }

  // Generic response either way (cooldown vs sent) — nothing meaningful to hide
  // here since the requester already owns this session, but keep it simple.
  return { error: null, ok: true };
}
