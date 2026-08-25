import { jwtVerify, SignJWT } from "jose";

// Deliberately a separate secret from AUTH_SECRET (the web session's NextAuth JWT) — same
// reasoning as WHATSAPP_TOKEN_ENCRYPTION_KEY being its own key (src/lib/crypto.ts): rotating one
// never forces rotating (or invalidates) the other. A leaked/rotated mobile API secret signs
// every native-app user out; it should never also sign out every browser session, and vice versa.
const ISSUER = "chatmeo-mobile-api";
// Long-lived on purpose — there's no refresh-token flow yet (see TODO below), so a short expiry
// would just log the app out from under the user with no way to silently renew. Revocation in
// the meantime is coarse (rotate MOBILE_API_JWT_SECRET, which signs every device out at once).
const EXPIRY = "30d";

function getSecret(): Uint8Array {
  const secret = process.env.MOBILE_API_JWT_SECRET;
  if (!secret) {
    throw new Error("MOBILE_API_JWT_SECRET must be set to issue or verify mobile API tokens.");
  }
  return new TextEncoder().encode(secret);
}

/** Mints a Bearer token for the native app to store and send as `Authorization: Bearer <token>`
 * on every subsequent request — see requireMobileUser below for the verifying side. */
export async function signMobileToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime(EXPIRY)
    .sign(getSecret());
}

/** Verifies a Bearer token and returns the userId it was issued for, or null for anything
 * invalid/expired/missing — never throws, so route handlers can treat every failure mode the
 * same way (a 401) without a try/catch at every call site. */
export async function verifyMobileToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { issuer: ISSUER });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Extracts and verifies the `Authorization: Bearer <token>` header from an API route's request,
 * returning the authenticated userId or null. The one thing every /api/v1/* route (other than
 * login itself) should call first. */
export async function requireMobileUser(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;
  return verifyMobileToken(token);
}
