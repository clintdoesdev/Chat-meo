import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { MeoMark } from "@/components/meo-mark";

export const metadata: Metadata = {
  title: "Settings — Chatmeo",
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <MeoMark size={40} />
      <h1 className="text-lg font-bold">Settings</h1>
      <p className="max-w-[36ch] text-sm text-muted">
        Profile, billing, and API key management ship in a later phase.
      </p>
      <p className="text-[12.5px] text-muted">
        Signed in as {session.user.email}
      </p>
    </div>
  );
}
