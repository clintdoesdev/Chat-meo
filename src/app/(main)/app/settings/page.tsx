import type { Metadata } from "next";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secret-crypto";
import { totpAuthUrl } from "@/lib/totp";
import { MeoMark } from "@/components/meo-mark";
import { TwoFactorSettings } from "@/components/app/two-factor-settings";

export const metadata: Metadata = {
  title: "Settings — Chatmeo",
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      passwordHash: true,
      twoFactorEnabled: true,
      twoFactorMethod: true,
      totpSecret: true,
    },
  });
  if (!user) redirect("/signin");

  const status = !user.twoFactorEnabled ? "off" : user.twoFactorMethod === "TOTP" ? "totp" : "email";

  // An unconfirmed authenticator-app setup left mid-flow — resume it instead of losing it.
  const pendingTotp =
    status === "off" && user.totpSecret
      ? await (async () => {
          const secret = decryptSecret(user.totpSecret!);
          const qrDataUrl = await QRCode.toDataURL(totpAuthUrl(secret, user.email), {
            margin: 1,
            width: 220,
          });
          return { qrDataUrl, secret };
        })()
      : null;

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <MeoMark size={40} />
      <h1 className="text-lg font-bold">Settings</h1>
      <p className="max-w-[36ch] text-sm text-muted">
        Profile, billing, and API key management ship in a later phase.
      </p>
      <p className="text-[12.5px] text-muted">Signed in as {user.email}</p>

      <div className="mt-3">
        <TwoFactorSettings
          initialStatus={status}
          hasPassword={Boolean(user.passwordHash)}
          pendingTotp={pendingTotp}
        />
      </div>
    </div>
  );
}
