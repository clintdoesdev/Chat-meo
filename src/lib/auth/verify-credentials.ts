import bcryptjs from "bcryptjs";
import { sendTwoFactorCodeEmail } from "@/lib/email/send";
import { issueVerificationCode, verifyCode } from "@/lib/otp";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secret-crypto";
import { verifyTotpCode } from "@/lib/totp";

// A precomputed bcrypt hash with no known plaintext. Comparing against this when a user doesn't
// exist (or has no password) keeps this function's timing indistinguishable between "no such
// user" and "wrong password" — closing a user-enumeration side channel. Same value auth.ts used
// before this was extracted, kept for no reason beyond not needing a new one.
const DUMMY_HASH = "$2b$10$VK/yXBml5EWgxKKpF0a/oe2NmtJwzOCu7yPE/lWotQBgSHeCTWroi";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export type VerifiedUser = { id: string; name: string; email: string; image: string | null };

export type VerifyCredentialsResult =
  | { kind: "ok"; user: VerifiedUser }
  | { kind: "invalid_credentials" }
  | { kind: "locked_out" }
  | { kind: "two_factor_required"; method: "TOTP" | "EMAIL" }
  | { kind: "invalid_two_factor_code" };

/**
 * The actual password + lockout + 2FA verification logic behind sign-in — extracted out of
 * NextAuth's Credentials provider (src/auth.ts) so the mobile API's own login endpoint
 * (src/app/api/v1/auth/login/route.ts) can share the exact same security behavior (timing-safe
 * comparison, failed-attempt lockout, TOTP/email 2FA) rather than a second, inevitably-drifting
 * implementation. auth.ts's authorize() is now a thin wrapper translating this result into
 * NextAuth's return-user/throw-error/return-null contract.
 */
export async function verifyCredentials(email: string, password: string, code?: string): Promise<VerifyCredentialsResult> {
  const user = await prisma.user.findUnique({ where: { email } });

  // Always run a bcrypt compare, even when there's no real hash to check against, so "no such
  // user" and "wrong password" take the same amount of time.
  const isValid = await bcryptjs.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user?.passwordHash || !isValid) {
    if (user?.passwordHash) {
      await registerFailedAttempt(user.id, user.failedLoginAttempts);
    }
    return { kind: "invalid_credentials" };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { kind: "locked_out" };
  }

  // Password is correct — lockout resets only once the whole sign-in (including any required
  // 2FA code) succeeds, so a wrong 2FA guess still counts toward it.
  if (user.twoFactorEnabled && user.twoFactorMethod === "TOTP" && user.totpSecret) {
    if (!code) {
      return { kind: "two_factor_required", method: "TOTP" };
    }

    const valid = verifyTotpCode(decryptSecret(user.totpSecret), code);
    if (!valid) {
      await registerFailedAttempt(user.id, user.failedLoginAttempts);
      return { kind: "invalid_two_factor_code" };
    }
  } else if (user.twoFactorEnabled) {
    if (!code) {
      const freshCode = await issueVerificationCode(user.id, "TWO_FACTOR");
      if (freshCode) {
        await sendTwoFactorCodeEmail(user.email, freshCode);
      }
      return { kind: "two_factor_required", method: "EMAIL" };
    }

    const result = await verifyCode(user.id, "TWO_FACTOR", code);
    if (result !== "ok") {
      await registerFailedAttempt(user.id, user.failedLoginAttempts);
      return { kind: "invalid_two_factor_code" };
    }
  }

  if (user.failedLoginAttempts > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  return { kind: "ok", user: { id: user.id, name: user.name, email: user.email, image: user.image } };
}

async function registerFailedAttempt(userId: string, currentAttempts: number) {
  const attempts = currentAttempts + 1;
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: attempts,
      lockedUntil: attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : undefined,
    },
  });
}
