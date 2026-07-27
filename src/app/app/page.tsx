import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { MeoMark } from "@/components/meo-mark";

export default async function AppPlaceholderPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <MeoMark size={40} />
      <h1 className="text-xl font-bold">Signed in as {session.user.name}</h1>
      <p className="max-w-[36ch] text-sm text-muted">
        The dashboard shell — top bar, stats, and bot list — ships in Phase 1,
        Step 4. This page confirms the {"/app"} route is protected.
      </p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/signin" });
        }}
      >
        <button
          type="submit"
          className="rounded-full border border-line-2 bg-card-2 px-5 py-2 text-sm font-semibold text-text transition hover:border-orange-2/50"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
