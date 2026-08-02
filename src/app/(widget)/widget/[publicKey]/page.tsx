import type { Metadata } from "next";
import { ErrorBoundary } from "@/components/error-boundary";
import { WidgetChat } from "@/components/widget/widget-chat";
import { lightenHex } from "@/lib/color";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Chat",
};

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="cm-app">
      <div className="cm-error-screen">
        <svg width="36" height="36" viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="24" cy="30" r="4.4" fill="#8f8f8f" />
          <circle cx="40" cy="30" r="4.4" fill="#8f8f8f" />
        </svg>
        <p>{message}</p>
      </div>
    </div>
  );
}

export default async function WidgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicKey: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { publicKey } = await params;
  const { v: visitorId } = await searchParams;

  const apiKey = await prisma.botApiKey.findUnique({
    where: { publicKey },
    select: {
      bot: {
        select: {
          name: true,
          status: true,
          primaryColor: true,
          theme: true,
          avatarUrl: true,
          welcomeMessage: true,
        },
      },
    },
  });

  if (!apiKey) {
    return <ErrorScreen message="This chat isn't available." />;
  }
  if (apiKey.bot.status !== "LIVE") {
    return <ErrorScreen message="This bot isn't live yet." />;
  }

  const primary = apiKey.bot.primaryColor;
  const primary2 = lightenHex(primary, 0.22);
  const theme = apiKey.bot.theme.toLowerCase();

  return (
    <div
      className="cm-app"
      data-cm-theme={theme}
      style={{ ["--cm-primary" as string]: primary, ["--cm-primary-2" as string]: primary2 }}
    >
      <div className="cm-header">
        {apiKey.bot.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary owner-supplied URL on a route that skips next/image's optimizer
          <img src={apiKey.bot.avatarUrl} alt="" className="cm-header-avatar" />
        ) : (
          <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true">
            <defs>
              <linearGradient id="cm-mark-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--cm-primary-2)" />
                <stop offset="1" stopColor="var(--cm-primary)" />
              </linearGradient>
            </defs>
            <path
              d="M32 6C17 6 6 16.4 6 30c0 7.8 3.8 14.5 9.9 18.9-.4 3.2-1.7 6.3-4.2 8.7-.7.7-.2 1.9.8 1.8 5.4-.5 10.2-2.6 13.8-5 1.8.3 3.7.5 5.7.5 15 0 26-10.4 26-23.9S47 6 32 6z"
              fill="url(#cm-mark-grad)"
            />
            <circle cx="24" cy="30" r="4.4" fill="#1a0b00" />
            <circle cx="40" cy="30" r="4.4" fill="#1a0b00" />
          </svg>
        )}
        <div>
          <div className="cm-header-name">{apiKey.bot.name}</div>
          <div className="cm-header-status">
            <span className="cm-dot" aria-hidden="true" />
            Online
          </div>
        </div>
      </div>

      <ErrorBoundary
        label="Widget chat"
        reloadOnRetry
        wrapperClassName="cm-error-screen"
        retryButtonClassName="cm-refresh-btn"
        retryLabel="Refresh"
        fallback={
          <>
            <svg width="36" height="36" viewBox="0 0 64 64" aria-hidden="true">
              <circle cx="24" cy="30" r="4.4" fill="#8f8f8f" />
              <circle cx="40" cy="30" r="4.4" fill="#8f8f8f" />
            </svg>
            <p>Something went wrong. Please refresh.</p>
          </>
        }
      >
        <WidgetChat
          botPublicKey={publicKey}
          visitorId={visitorId || null}
          welcomeMessage={apiKey.bot.welcomeMessage}
        />
      </ErrorBoundary>
    </div>
  );
}
