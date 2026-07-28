"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendSecurityAlertEmail } from "@/lib/email/send";

type ActionResult = { error: string | null; ok?: boolean };

export async function setTwoFactorEnabled(enabled: boolean): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Sign in to change this setting." };
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return { error: "Sign in to change this setting." };
  }

  if (!user.passwordHash) {
    return {
      error: "Two-factor codes require a password on your account — set one before enabling this.",
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: enabled },
  });

  await sendSecurityAlertEmail(
    user.email,
    enabled ? "Two-factor authentication turned on" : "Two-factor authentication turned off",
    enabled
      ? "Two-factor authentication was just enabled on your account. You'll be asked for a code by email on future sign-ins."
      : "Two-factor authentication was just turned off on your account. If this wasn't you, reset your password immediately.",
  );

  return { error: null, ok: true };
}
