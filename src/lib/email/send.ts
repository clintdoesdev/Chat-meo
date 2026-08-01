import { getEmailFrom, getResendClient } from "@/lib/email/resend";
import {
  accountConflictTemplate,
  betaFeedbackTemplate,
  emailVerificationTemplate,
  newSignInTemplate,
  passwordResetTemplate,
  securityAlertTemplate,
  supportReplyTemplate,
  twoFactorCodeTemplate,
} from "@/lib/email/templates";

async function dispatch(
  to: string,
  template: { subject: string; html: string },
  attachments?: { filename: string; content: Buffer; contentType: string }[],
): Promise<void> {
  const client = getResendClient();
  if (!client) {
    console.warn(`[email] RESEND_API_KEY not set — skipping send to ${to}: ${template.subject}`);
    return;
  }

  const { error } = await client.emails.send({
    from: getEmailFrom(),
    to,
    subject: template.subject,
    html: template.html,
    ...(attachments ? { attachments } : {}),
  });

  if (error) {
    console.error("[email] Resend send failed", error);
  }
}

export function sendVerificationEmail(to: string, code: string) {
  return dispatch(to, emailVerificationTemplate(code));
}

export function sendPasswordResetEmail(to: string, code: string) {
  return dispatch(to, passwordResetTemplate(code));
}

export function sendTwoFactorCodeEmail(to: string, code: string) {
  return dispatch(to, twoFactorCodeTemplate(code));
}

export function sendAccountConflictEmail(to: string) {
  return dispatch(to, accountConflictTemplate());
}

export function sendNewSignInEmail(
  to: string,
  details: { time: string; device: string; ip: string; method: string },
) {
  return dispatch(to, newSignInTemplate(details));
}

/** Reusable sender for security/account notices (password changed, 2FA toggled, etc). */
export function sendSecurityAlertEmail(to: string, title: string, message: string) {
  return dispatch(to, securityAlertTemplate(title, message));
}

/** Reusable sender for customer-support replies — not wired to any UI/ticketing yet. */
export function sendSupportReplyEmail(to: string, subject: string, message: string) {
  return dispatch(to, supportReplyTemplate(subject, message));
}

/** Beta feedback widget → email-to-yourself, the lowest-setup option for now (no Feedback
 * table). Silently skipped (with a console warning) if FEEDBACK_EMAIL_TO isn't configured, same
 * as every other send here does when RESEND_API_KEY is missing. */
export function sendBetaFeedbackEmail(
  fromEmail: string,
  message: string,
  screenshot?: { buffer: Buffer; contentType: string },
) {
  const to = process.env.FEEDBACK_EMAIL_TO;
  if (!to) {
    console.warn("[email] FEEDBACK_EMAIL_TO not set — dropping beta feedback from", fromEmail);
    return Promise.resolve();
  }

  const ext = screenshot?.contentType.split("/")[1] ?? "png";
  return dispatch(
    to,
    betaFeedbackTemplate(fromEmail, message, Boolean(screenshot)),
    screenshot
      ? [{ filename: `screenshot.${ext}`, content: screenshot.buffer, contentType: screenshot.contentType }]
      : undefined,
  );
}
