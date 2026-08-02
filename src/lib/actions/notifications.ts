"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Marks every "needs a human" notification up to now as read — a single timestamp rather than
 * per-conversation tracking, so this is a "read everything so far" action, not a per-item one. */
export async function markNotificationsRead(): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sign in to do that." };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { notificationsReadAt: new Date() },
  });

  revalidatePath("/app", "layout");
  return { error: null };
}
