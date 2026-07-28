import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MeoMark } from "@/components/meo-mark";
import { TwoFactorToggle } from "@/components/app/two-factor-toggle";

export const metadata: Metadata = {
  title: "Settings — Chatmeo",
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, twoFactorEnabled: true, passwordHash: true },
  });
  if (!user) redirect("/signin");

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <MeoMark size={40} />
      <h1 className="text-lg font-bold">Settings</h1>
      <p className="max-w-[36ch] text-sm text-muted">
        Profile, billing, and API key management ship in a later phase.
      </p>
      <p className="text-[12.5px] text-muted">Signed in as {user.email}</p>

      <div className="mt-3">
        <TwoFactorToggle
          initialEnabled={user.twoFactorEnabled}
          hasPassword={Boolean(user.passwordHash)}
        />
      </div>
    </div>
  );
}
