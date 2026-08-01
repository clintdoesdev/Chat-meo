import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BetaFeedbackButton } from "@/components/app/beta-feedback-button";
import { TopBar } from "@/components/app/top-bar";

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

  return (
    <div className="min-h-screen">
      <TopBar name={session.user.name ?? ""} email={session.user.email ?? ""} />
      <main className="mx-auto max-w-[1240px] px-[22px] pb-24 pt-[26px] min-[760px]:pb-10">
        {children}
      </main>
      <BetaFeedbackButton />
    </div>
  );
}
