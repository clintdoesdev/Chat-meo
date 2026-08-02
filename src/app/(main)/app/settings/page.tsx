import type { Metadata } from "next";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secret-crypto";
import { totpAuthUrl } from "@/lib/totp";
import { FeedbackSettings } from "@/components/app/feedback-settings";
import { ProfileSettings } from "@/components/app/profile-settings";
import { SettingsTabs } from "@/components/app/settings-tabs";
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
      name: true,
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
    <div>
      <div className="mb-[22px]">
        <h1 className="text-[22px] font-bold tracking-tight">Settings</h1>
        <p className="mt-0.5 text-[12.5px] text-muted">Signed in as {user.email}</p>
      </div>

      <SettingsTabs
        tabs={[
          {
            id: "profile",
            label: "Profile",
            content: <ProfileSettings name={user.name} email={user.email} />,
          },
          {
            id: "security",
            label: "Security",
            content: (
              <TwoFactorSettings
                initialStatus={status}
                hasPassword={Boolean(user.passwordHash)}
                pendingTotp={pendingTotp}
              />
            ),
          },
          {
            id: "feedback",
            label: "Feedback",
            content: <FeedbackSettings />,
          },
        ]}
      />
    </div>
  );
}
