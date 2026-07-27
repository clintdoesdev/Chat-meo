"use server";

import { signIn, signOut } from "@/auth";

export async function signOutAction() {
  await signOut({ redirectTo: "/signin" });
}

export async function googleSignInAction(formData: FormData) {
  const callbackUrl = String(formData.get("callbackUrl") ?? "/app");
  await signIn("google", { redirectTo: callbackUrl });
}
