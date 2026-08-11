"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BotSettingsModal } from "@/components/app/bot-settings-modal";
import { Toast } from "@/components/studio/toast";
import { getEmbedConfig } from "@/lib/actions/embed";

// Populated by src/app/api/whatsapp/connect/callback/route.ts's redirect back to /app — that
// route doesn't know which page/modal the seller had open when they clicked "Connect WhatsApp",
// so this is the one place that picks the pieces back up: it reopens that bot's settings on the
// Deploy & channels tab (where the WhatsApp card already shows the fresh connection state) and
// shows a toast, rather than leaving the seller stranded on the bare dashboard.
const STATUS_COPY: Record<string, { message: string; tone: "ok" | "bad" }> = {
  connected: { message: "WhatsApp connected", tone: "ok" },
  cancelled: { message: "WhatsApp sign-in was cancelled", tone: "bad" },
  error: { message: "Couldn't connect WhatsApp — try again", tone: "bad" },
};

// A few MetaGraphError step labels (see complete-connection.ts) worth a more specific toast than
// the generic one above — kept short since this renders in a pill, not a paragraph. Everything
// else falls back to the generic message; the raw Graph API error text itself never reaches the
// URL or the client.
const STEP_HINTS: Record<string, string> = {
  "WABA discovery": "Couldn't find a WhatsApp Business Account for that login",
  "duplicate number": "That number is already connected to another bot",
};

export function WhatsAppConnectRedirectHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [toast, setToast] = useState<{ message: string; tone: "ok" | "bad" } | null>(null);
  const [reopenBot, setReopenBot] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const status = searchParams.get("whatsapp");
    const botId = searchParams.get("botId");
    const step = searchParams.get("step");
    if (!status) return;

    const copy = STATUS_COPY[status];
    if (copy) {
      const message = status === "error" && step && STEP_HINTS[step] ? STEP_HINTS[step] : copy.message;
      setToast({ message, tone: copy.tone });
    }

    if (botId) {
      getEmbedConfig(botId).then((result) => {
        if (!("error" in result)) setReopenBot({ id: botId, name: result.name });
      });
    }

    // Strips the query params so refreshing (or sharing the URL) doesn't replay the toast or
    // reopen the modal a second time.
    const params = new URLSearchParams(searchParams);
    params.delete("whatsapp");
    params.delete("botId");
    params.delete("step");
    router.replace(params.size ? `/app?${params.toString()}` : "/app", { scroll: false });
    // Only re-run when the status itself changes, not on every render (router.replace above
    // would otherwise re-trigger this if searchParams/router identity churned).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("whatsapp")]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <>
      {toast && <Toast message={toast.message} tone={toast.tone} />}
      {reopenBot && (
        <BotSettingsModal
          botId={reopenBot.id}
          botName={reopenBot.name}
          defaultTab="embed"
          onClose={() => setReopenBot(null)}
        />
      )}
    </>
  );
}
