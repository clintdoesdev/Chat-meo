"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Toast } from "@/components/studio/toast";

// Populated by src/app/api/whatsapp/connect/callback/route.ts's redirect back to /app — the
// dashboard is the only page that flow can land on (it doesn't know which tab/modal the seller
// had open), so feedback surfaces here as a toast rather than inline in the WhatsApp panel.
const STATUS_COPY: Record<string, { message: string; tone: "ok" | "bad" }> = {
  connected: { message: "WhatsApp connected", tone: "ok" },
  cancelled: { message: "WhatsApp sign-in was cancelled", tone: "bad" },
  error: { message: "Couldn't connect WhatsApp — try again", tone: "bad" },
};

export function WhatsAppConnectStatusToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [shown, setShown] = useState<{ message: string; tone: "ok" | "bad" } | null>(null);

  useEffect(() => {
    const status = searchParams.get("whatsapp");
    if (!status) return;

    setShown(STATUS_COPY[status] ?? null);

    // Strips the query param so refreshing (or sharing the URL) doesn't replay the toast.
    const params = new URLSearchParams(searchParams);
    params.delete("whatsapp");
    router.replace(params.size ? `/app?${params.toString()}` : "/app", { scroll: false });
    // Only re-run when the raw query string actually changes, not on every render (router.replace
    // above would otherwise re-trigger this if searchParams/router identity churned).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("whatsapp")]);

  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(null), 3000);
    return () => clearTimeout(timer);
  }, [shown]);

  if (!shown) return null;
  return <Toast message={shown.message} tone={shown.tone} />;
}
