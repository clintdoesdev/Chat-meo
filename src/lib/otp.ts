import { randomInt } from "crypto";
import bcryptjs from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { VerificationPurpose } from "@/generated/prisma/client";

const CODE_LENGTH = 6;
const EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const REQUEST_COOLDOWN_SECONDS = 60;

type Purpose = VerificationPurpose;

function generateNumericCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += randomInt(0, 10).toString();
  }
  return code;
}

/**
 * Creates a new verification code for the given user/purpose, invalidating any
 * previous unconsumed code for that purpose. Returns null (instead of a code)
 * if a code was already requested within the cooldown window, so callers can
 * avoid spamming the recipient's inbox.
 */
export async function issueVerificationCode(
  userId: string,
  purpose: Purpose,
): Promise<string | null> {
  const recent = await prisma.verificationCode.findFirst({
    where: { userId, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (recent) {
    const ageSeconds = (Date.now() - recent.createdAt.getTime()) / 1000;
    if (ageSeconds < REQUEST_COOLDOWN_SECONDS) {
      return null;
    }
  }

  await prisma.verificationCode.deleteMany({ where: { userId, purpose, consumedAt: null } });

  const code = generateNumericCode();
  const codeHash = await bcryptjs.hash(code, 10);

  await prisma.verificationCode.create({
    data: {
      userId,
      purpose,
      codeHash,
      expiresAt: new Date(Date.now() + EXPIRY_MINUTES * 60_000),
    },
  });

  return code;
}

export type VerifyCodeResult = "ok" | "invalid" | "expired" | "locked";

export async function verifyCode(
  userId: string,
  purpose: Purpose,
  submittedCode: string,
): Promise<VerifyCodeResult> {
  const record = await prisma.verificationCode.findFirst({
    where: { userId, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!record) return "invalid";

  if (record.attempts >= MAX_ATTEMPTS) return "locked";

  if (record.expiresAt < new Date()) {
    await prisma.verificationCode.delete({ where: { id: record.id } });
    return "expired";
  }

  const isValid = await bcryptjs.compare(submittedCode, record.codeHash);

  if (!isValid) {
    await prisma.verificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return "invalid";
  }

  await prisma.verificationCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });

  return "ok";
}
