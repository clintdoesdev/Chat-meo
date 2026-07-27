import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInCard } from "@/components/auth/sign-in-card";

export const metadata: Metadata = {
  title: "Sign in — Chatmeo",
  description: "Sign in or create a Chatmeo account to start building bots with Meo.",
};

export default function SignInPage() {
  return (
    <Suspense>
      <SignInCard />
    </Suspense>
  );
}
