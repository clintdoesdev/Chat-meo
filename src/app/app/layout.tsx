import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TopBar } from "@/components/app/top-bar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return (
    <div className="min-h-screen">
      <TopBar name={session.user.name ?? ""} email={session.user.email ?? ""} />
      <main className="mx-auto max-w-[1240px] px-[22px] pb-24 pt-[26px] min-[760px]:pb-10">
        {children}
      </main>
    </div>
  );
}
