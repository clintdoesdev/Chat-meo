"use server";

import QRCode from "qrcode";
import { auth } from "@/auth";
import { sendSecurityAlertEmail } from "@/lib/email/send";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/secret-crypto";
import { generateTotpSecret, totpAuthUrl, verifyTotpCode } from "@/lib/totp";

type ActionResult = { error: string | null; ok?: boolean };
type TotpSetupResult = { error: string | null; qrDataUrl?: string; secret?: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: session.user.id } });
}

export async function enableEmailTwoFactor(): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { error: "Sign in to change this setting." };
  if (!user.passwordHash) {
    return {
      error: "Two-factor codes require a password on your account — set one before enabling this.",
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: true, twoFactorMethod: "EMAIL", totpSecret: null },
  });

  await sendSecurityAlertEmail(
    user.email,
    "Two-factor authentication turned on",
    "Email-code two-factor authentication was just enabled on your account. You'll be asked for a code by email on future sign-ins.",
  );

  return { error: null, ok: true };
}

/** Starts (or restarts) authenticator-app setup: generates a pending, unconfirmed secret. */
export async function beginTotpSetup(): Promise<TotpSetupResult> {
  const user = await requireUser();
  if (!user) return { error: "Sign in to change this setting." };
  if (!user.passwordHash) {
    return {
      error: "Two-factor codes require a password on your account — set one before enabling this.",
    };
  }

  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: encryptSecret(secret) },
  });

  const url = totpAuthUrl(secret, user.email);
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 220 });

  return { error: null, qrDataUrl, secret };
}

/** Confirms a pending authenticator-app setup with a code from the app, and activates it. */
export async function confirmTotpSetup(code: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { error: "Sign in to change this setting." };
  if (!user.totpSecret) {
    return { error: "Start setup again — no pending authenticator app to confirm." };
  }

  const valid = verifyTotpCode(decryptSecret(user.totpSecret), code);
  if (!valid) {
    return { error: "That code isn't right. Check your app and try again." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: true, twoFactorMethod: "TOTP" },
  });

  await sendSecurityAlertEmail(
    user.email,
    "Two-factor authentication turned on",
    "Authenticator-app two-factor authentication was just enabled on your account. You'll be asked for a code from your app on future sign-ins.",
  );

  return { error: null, ok: true };
}

/** Clears an unconfirmed authenticator-app setup the user backed out of. */
export async function cancelTotpSetup(): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { error: "Sign in to change this setting." };
  if (user.twoFactorMethod !== "TOTP" || !user.twoFactorEnabled) {
    await prisma.user.update({ where: { id: user.id }, data: { totpSecret: null } });
  }
  return { error: null, ok: true };
}

export async function disableTwoFactor(): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return { error: "Sign in to change this setting." };

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: false, twoFactorMethod: null, totpSecret: null },
  });

  await sendSecurityAlertEmail(
    user.email,
    "Two-factor authentication turned off",
    "Two-factor authentication was just turned off on your account. If this wasn't you, reset your password immediately.",
  );

  return { error: null, ok: true };
}
