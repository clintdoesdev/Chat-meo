"use server";

import { auth } from "@/auth";
import { sendBetaFeedbackEmail } from "@/lib/email/send";

const MAX_MESSAGE_LENGTH = 4000;
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const ALLOWED_SCREENSHOT_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function submitFeedback(formData: FormData): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user?.email) return { error: "Not signed in." };

  const message = String(formData.get("message") ?? "").trim();
  if (!message) return { error: "Add a quick note before sending." };
  if (message.length > MAX_MESSAGE_LENGTH) return { error: "That's a bit long — try trimming it down." };

  const screenshotFile = formData.get("screenshot");
  let screenshot: { buffer: Buffer; contentType: string } | undefined;

  if (screenshotFile instanceof File && screenshotFile.size > 0) {
    if (!ALLOWED_SCREENSHOT_TYPES.has(screenshotFile.type)) {
      return { error: "Screenshots must be PNG, JPEG, or WebP." };
    }
    if (screenshotFile.size > MAX_SCREENSHOT_BYTES) {
      return { error: "Screenshot is too large (max 5MB)." };
    }
    screenshot = {
      buffer: Buffer.from(await screenshotFile.arrayBuffer()),
      contentType: screenshotFile.type,
    };
  }

  await sendBetaFeedbackEmail(session.user.email, message, screenshot);
  console.log("[feedback] submitted", { userId: session.user.id, hasScreenshot: Boolean(screenshot) });

  return { error: null };
}
