import { getEmailFrom, getResendClient } from "@/lib/email/resend";
import {
  accountConflictTemplate,
  emailVerificationTemplate,
  newSignInTemplate,
  passwordResetTemplate,
  securityAlertTemplate,
  supportReplyTemplate,
  twoFactorCodeTemplate,
} from "@/lib/email/templates";

async function dispatch(to: string, template: { subject: string; html: string }): Promise<void> {
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
