import type { Metadata } from "next";
import { MeoMark } from "@/components/meo-mark";

export const metadata: Metadata = {
  title: "Inbox — Chatmeo",
};

export default function InboxPage() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <MeoMark size={40} />
      <h1 className="text-lg font-bold">Inbox</h1>
      <p className="max-w-[36ch] text-sm text-muted">
        Live conversation handoff and history ship in a later phase.
      </p>
    </div>
  );
}
