const ORANGE = "#FF5C16";
const INK = "#171717";
const MUTED = "#71717a";
const BORDER = "#e4e4e7";

/** Defensive escaping for any text that isn't a developer-authored literal. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shell(preheader: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Chatmeo</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:16px;border:1px solid ${BORDER};overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 0 32px;">
              <span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${ORANGE};margin-right:8px;vertical-align:middle;"></span>
              <span style="font-size:17px;font-weight:700;color:${INK};vertical-align:middle;">chatmeo</span>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 32px 32px;color:${INK};font-size:14px;line-height:1.6;">
              ${bodyHtml}
            </td>
          </tr>
        </table>
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
          <tr>
            <td style="padding:18px 32px;text-align:center;color:${MUTED};font-size:12px;">
              Chatmeo &middot; you're receiving this because it relates to your account.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function codeBlock(code: string): string {
  return `<div style="margin:20px 0;text-align:center;background:#fff7f2;border:1px solid #ffd9c2;border-radius:12px;padding:18px;">
    <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:${ORANGE};">${code}</span>
  </div>`;
}

export function emailVerificationTemplate(code: string): { subject: string; html: string } {
  return {
    subject: "Verify your Chatmeo email",
    html: shell(
      `Your verification code is ${code}`,
      `<p style="margin:0 0 4px 0;font-weight:600;font-size:16px;">Verify your email</p>
       <p style="margin:0;color:${MUTED};">Enter this code to confirm it's really you. It expires in 10 minutes.</p>
       ${codeBlock(code)}
       <p style="margin:0;color:${MUTED};">If you didn't create a Chatmeo account, you can ignore this email.</p>`,
    ),
  };
}

export function passwordResetTemplate(code: string): { subject: string; html: string } {
  return {
    subject: "Reset your Chatmeo password",
    html: shell(
      `Your password reset code is ${code}`,
      `<p style="margin:0 0 4px 0;font-weight:600;font-size:16px;">Reset your password</p>
       <p style="margin:0;color:${MUTED};">Enter this code to choose a new password. It expires in 10 minutes.</p>
       ${codeBlock(code)}
       <p style="margin:0;color:${MUTED};">If you didn't request this, your password is still safe — just ignore this email.</p>`,
    ),
  };
}

export function twoFactorCodeTemplate(code: string): { subject: string; html: string } {
  return {
    subject: "Your Chatmeo sign-in code",
    html: shell(
      `Your sign-in code is ${code}`,
      `<p style="margin:0 0 4px 0;font-weight:600;font-size:16px;">Confirm it's you</p>
       <p style="margin:0;color:${MUTED};">Enter this code to finish signing in. It expires in 10 minutes.</p>
       ${codeBlock(code)}
       <p style="margin:0;color:${MUTED};">If you didn't try to sign in, change your password immediately.</p>`,
    ),
  };
}

export function accountConflictTemplate(): { subject: string; html: string } {
  return {
    subject: "Someone tried to use your email on Chatmeo",
    html: shell(
      "Someone tried to sign up with your email",
      `<p style="margin:0 0 4px 0;font-weight:600;font-size:16px;">Just so you know</p>
       <p style="margin:0;color:${MUTED};">Someone just tried to create a Chatmeo account with this email address. If that was you, sign in to your existing account instead. If it wasn't you, no action is needed — your account is safe.</p>`,
    ),
  };
}

export function newSignInTemplate(details: {
  time: string;
  device: string;
  ip: string;
  method: string;
}): { subject: string; html: string } {
  const row = (label: string, value: string) =>
    `<tr>
       <td style="padding:6px 0;color:${MUTED};width:88px;">${escapeHtml(label)}</td>
       <td style="padding:6px 0;color:${INK};font-weight:600;">${escapeHtml(value)}</td>
     </tr>`;

  return {
    subject: "New sign-in to your Chatmeo account",
    html: shell(
      "New sign-in to your Chatmeo account",
      `<p style="margin:0 0 4px 0;font-weight:600;font-size:16px;">New sign-in detected</p>
       <p style="margin:0 0 14px 0;color:${MUTED};">Your Chatmeo account was just signed into.</p>
       <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:13px;border-top:1px solid ${BORDER};border-bottom:1px solid ${BORDER};margin:6px 0 16px 0;">
         ${row("Time", details.time)}
         ${row("Method", details.method)}
         ${row("Device", details.device)}
         ${row("IP address", details.ip)}
       </table>
       <p style="margin:0;color:${MUTED};">If this was you, no action is needed. If you don't recognize this sign-in, reset your password immediately.</p>`,
    ),
  };
}

export function securityAlertTemplate(title: string, message: string): { subject: string; html: string } {
  const safeTitle = escapeHtml(title);
  return {
    subject: `Chatmeo security alert: ${safeTitle}`,
    html: shell(
      safeTitle,
      `<p style="margin:0 0 4px 0;font-weight:600;font-size:16px;">${safeTitle}</p>
       <p style="margin:0;color:${MUTED};">${escapeHtml(message)}</p>
       <p style="margin:16px 0 0 0;color:${MUTED};">If this wasn't you, reset your password right away.</p>`,
    ),
  };
}

export function supportReplyTemplate(subject: string, message: string): { subject: string; html: string } {
  const safeSubject = escapeHtml(subject);
  return {
    subject: safeSubject,
    html: shell(
      safeSubject,
      `<p style="margin:0 0 4px 0;font-weight:600;font-size:16px;">${safeSubject}</p>
       <div style="margin:0;color:${INK};white-space:pre-line;">${escapeHtml(message)}</div>
       <p style="margin:16px 0 0 0;color:${MUTED};">— The Chatmeo team</p>`,
    ),
  };
}
