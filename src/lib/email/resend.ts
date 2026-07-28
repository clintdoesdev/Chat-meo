import { Resend } from "resend";

let client: Resend | null = null;

/** Lazily constructed so a missing key doesn't crash builds/imports — only actual sends. */
export function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Resend(apiKey);
  return client;
}

export function getEmailFrom(): string {
  return process.env.EMAIL_FROM || "Chatmeo <onboarding@resend.dev>";
}
