import bcryptjs from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import authConfig from "@/auth.config";
import { InvalidTwoFactorCodeError, TwoFactorRequiredError } from "@/lib/auth-errors";
import { sendNewSignInEmail, sendTwoFactorCodeEmail } from "@/lib/email/send";
import { issueVerificationCode, verifyCode } from "@/lib/otp";
import { prisma } from "@/lib/prisma";
import { getClientInfo } from "@/lib/request-info";

// A precomputed bcrypt hash with no known plaintext. Comparing against this when a
// user doesn't exist (or has no password) keeps authorize()'s timing indistinguishable
// from the "wrong password" path, closing a user-enumeration side channel.
const DUMMY_HASH = "$2b$10$VK/yXBml5EWgxKKpF0a/oe2NmtJwzOCu7yPE/lWotQBgSHeCTWroi";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { label: "Email" },
        password: { label: "Password" },
        code: { label: "Code" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        const code = credentials?.code;

        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });

        // Always run a bcrypt compare, even when there's no real hash to check against,
        // so "no such user" and "wrong password" take the same amount of time.
        const isValid = await bcryptjs.compare(password, user?.passwordHash ?? DUMMY_HASH);

        if (!user?.passwordHash || !isValid) {
          if (user?.passwordHash) {
            await registerFailedAttempt(user.id, user.failedLoginAttempts);
          }
          return null;
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          return null;
        }

        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          });
        }

        if (user.twoFactorEnabled) {
          if (typeof code !== "string" || code.length === 0) {
            const freshCode = await issueVerificationCode(user.id, "TWO_FACTOR");
            if (freshCode) {
              await sendTwoFactorCodeEmail(user.email, freshCode);
            }
            throw new TwoFactorRequiredError();
          }

          const result = await verifyCode(user.id, "TWO_FACTOR", code);
          if (result !== "ok") {
            throw new InvalidTwoFactorCodeError();
          }
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) return false;
        await prisma.user.upsert({
          where: { email: user.email },
          update: {
            name: user.name ?? undefined,
            image: user.image ?? undefined,
            emailVerified: new Date(),
          },
          create: {
            email: user.email,
            name: user.name ?? user.email,
            image: user.image ?? undefined,
            emailVerified: new Date(),
          },
        });
      }

      if (user.email) {
        const { ip, device } = await getClientInfo();
        await sendNewSignInEmail(user.email, {
          time: new Date().toUTCString(),
          device,
          ip,
          method: account?.provider === "google" ? "Google" : "Password",
        });
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
        });
        if (dbUser) {
          token.id = dbUser.id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});

async function registerFailedAttempt(userId: string, currentAttempts: number) {
  const attempts = currentAttempts + 1;
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: attempts,
      lockedUntil:
        attempts >= MAX_FAILED_ATTEMPTS
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
          : undefined,
    },
  });
}
