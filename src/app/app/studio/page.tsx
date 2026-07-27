import type { Metadata } from "next";
import { MeoMark } from "@/components/meo-mark";

export const metadata: Metadata = {
  title: "Studio — Chatmeo",
};

export default function StudioPage() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <MeoMark size={40} />
      <h1 className="text-lg font-bold">Flow Studio</h1>
      <p className="max-w-[36ch] text-sm text-muted">
        The drag-and-drop flow builder ships in a later phase.
      </p>
    </div>
  );
}
