import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Public click-to-chat redirect — /l/{slug} sends the visitor straight to a WhatsApp chat with
 * the bot's connected number, message box already filled in (see WhatsAppShortLink in
 * schema.prisma and createWhatsAppShortLink in lib/actions/whatsapp-short-links.ts). No auth:
 * this is meant to be pasted into ads, bios, and posts, so anyone can follow it.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;

  const link = await prisma.whatsAppShortLink.findUnique({
    where: { slug },
    select: { id: true, phoneNumber: true, message: true },
  });
  if (!link) {
    return new NextResponse("This link doesn't exist or has been removed.", { status: 404 });
  }

  // Fire-and-forget: a click still has to redirect even if this write fails or is slow — the
  // count is a nice-to-have for the seller's dashboard, not something the redirect should ever
  // wait on or fail over.
  prisma.whatsAppShortLink
    .update({ where: { id: link.id }, data: { clickCount: { increment: 1 } } })
    .catch((error) => console.error("[whatsapp short link] failed to record click", { slug, error }));

  const target = new URL(`https://wa.me/${link.phoneNumber}`);
  target.searchParams.set("text", link.message);
  return NextResponse.redirect(target, { status: 302 });
}
