"use server";

import bcryptjs from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail, sendSecurityAlertEmail } from "@/lib/email/send";
import { issueVerificationCode, verifyCode } from "@/lib/otp";

type ActionResult = { error: string | null; ok?: boolean };

// Same generic message regardless of whether the email is registered, has a
// password (vs. Google-only), or just requested a code — so responses can't
// be used to enumerate accounts.
const GENERIC_REQUEST_RESULT: ActionResult = {
  error: null,
  ok: true,
};

export async function requestPasswordReset(rawEmail: string): Promise<ActionResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) {
    return { error: "Enter your email address." };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (user?.passwordHash) {
    const code = await issueVerificationCode(user.id, "PASSWORD_RESET");
    if (code) {
      await sendPasswordResetEmail(email, code);
    }
  }
  // If there's no user, or the account is Google-only (no passwordHash), do
  // nothing observable — same generic response either way.

  return GENERIC_REQUEST_RESULT;
}

// A precomputed bcrypt hash with no known plaintext, used to keep this path's
// timing indistinguishable from a real code check when no user/account exists.
const DUMMY_HASH = "$2b$10$VK/yXBml5EWgxKKpF0a/oe2NmtJwzOCu7yPE/lWotQBgSHeCTWroi";

export async function resetPassword(
  rawEmail: string,
  code: string,
  newPassword: string,
): Promise<ActionResult> {
  const email = rawEmail.trim().toLowerCase();

  if (newPassword.length < 8) {
    return { error: "Password needs at least 8 characters." };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user?.passwordHash) {
    await bcryptjs.compare(code, DUMMY_HASH);
    return { error: "That code isn't right." };
  }

  const result = await verifyCode(user.id, "PASSWORD_RESET", code);

  if (result === "expired") {
    return { error: "That code expired. Request a new one." };
  }
  if (result === "locked") {
    return { error: "Too many attempts. Request a new code." };
  }
  if (result !== "ok") {
    return { error: "That code isn't right." };
  }

  const passwordHash = await bcryptjs.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
  });

  await sendSecurityAlertEmail(
    email,
    "Your password was changed",
    "Your Chatmeo password was just reset. If this wasn't you, contact support immediately.",
  );

  return { error: null, ok: true };
}
