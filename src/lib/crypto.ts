import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// Deliberately a separate key/module from src/lib/secret-crypto.ts (which encrypts TOTP seeds
// with AUTH_SECRET) rather than reusing that one — WhatsApp access tokens are a distinct trust
// boundary from session/auth secrets, so rotating WHATSAPP_TOKEN_ENCRYPTION_KEY (e.g. after a
// suspected leak) never forces rotating AUTH_SECRET (which would sign out every session) or vice
// versa. Same AES-256-GCM scheme and iv:authTag:ciphertext format as secret-crypto.ts otherwise.
const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("WHATSAPP_TOKEN_ENCRYPTION_KEY must be set to encrypt secrets at rest.");
  }
  return createHash("sha256").update(secret).digest();
}

/** Encrypts a value (e.g. a WhatsApp access token) for storage. Format: iv:authTag:ciphertext, all base64. */
export function encrypt(plainText: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((buf) => buf.toString("base64")).join(":");
}

export function decrypt(stored: string): string {
  const [ivB64, authTagB64, ciphertextB64] = stored.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const plainText = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plainText.toString("utf8");
}
