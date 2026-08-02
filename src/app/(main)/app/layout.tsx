import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/app/top-bar";

const MAX_NOTIFICATIONS = 8;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerified: true },
  });
  if (!dbUser) redirect("/signin");
  if (!dbUser.emailVerified) redirect("/verify-email");

  // "Needs a human" conversations double as this app's only notification source for now —
  // they're the one thing that genuinely needs the owner's attention without them going and
  // checking the Inbox themselves.
  const handoffConversations = await prisma.conversation.findMany({
    where: { status: "HANDOFF", bot: { userId: session.user.id } },
    orderBy: { createdAt: "desc" },
    take: MAX_NOTIFICATIONS,
    select: { id: true, visitorId: true, createdAt: true, bot: { select: { name: true } } },
  });

  const notifications = handoffConversations.map((c) => ({
    id: c.id,
    botName: c.bot.name,
    visitorId: c.visitorId,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div className="min-h-screen">
      <TopBar
        name={session.user.name ?? ""}
        email={session.user.email ?? ""}
        notifications={notifications}
      />
      <main className="mx-auto max-w-[1240px] px-[22px] pb-24 pt-[26px] min-[760px]:pb-10">
        {children}
      </main>
    </div>
  );
}
