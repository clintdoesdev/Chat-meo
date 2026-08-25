import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-auth/token";

export async function GET(request: NextRequest) {
  const userId = await requireMobileUser(request);
  if (!userId) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const bots = await prisma.bot.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, slug: true, status: true, avatarUrl: true, primaryColor: true },
  });

  return NextResponse.json({ bots });
}
