"use server";

import { auth, updateSession } from "@/auth";
import { prisma } from "@/lib/prisma";

type ActionResult = { error: string | null; ok?: boolean };

const MAX_NAME_LENGTH = 80;

export async function updateProfileName(input: { name: string }): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sign in to change this setting." };

  const name = input.name.trim();
  if (!name) return { error: "Name can't be empty." };
  if (name.length > MAX_NAME_LENGTH) return { error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name },
  });

  // Refreshes the JWT's name claim so the top bar / avatar reflect the change without
  // requiring a fresh sign-in — see the jwt callback's trigger === "update" branch.
  await updateSession({ user: { name } });

  return { error: null, ok: true };
}
