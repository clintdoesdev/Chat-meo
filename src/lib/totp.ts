import * as OTPAuth from "otpauth";

const ISSUER = "Chatmeo";

function buildTotp(base32Secret: string, email: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(base32Secret),
  });
}

/** A fresh random base32 TOTP seed — not yet persisted or confirmed. */
export function generateTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export function totpAuthUrl(base32Secret: string, email: string): string {
  return buildTotp(base32Secret, email).toString();
}

/** Validates a submitted code against the secret, allowing +/-1 step (30s) of clock drift. */
export function verifyTotpCode(base32Secret: string, code: string): boolean {
  const totp = buildTotp(base32Secret, "verify");
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}
