import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import authConfig from "@/auth.config";
import {
  InvalidTwoFactorCodeError,
  TwoFactorRequiredEmailError,
  TwoFactorRequiredTotpError,
} from "@/lib/auth-errors";
import { verifyCredentials } from "@/lib/auth/verify-credentials";
import { sendNewSignInEmail } from "@/lib/email/send";
import { prisma } from "@/lib/prisma";
import { getClientInfo } from "@/lib/request-info";

export const { handlers, auth, signIn, signOut, unstable_update: updateSession } = NextAuth({
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

        const result = await verifyCredentials(email, password, typeof code === "string" && code.length > 0 ? code : undefined);

        switch (result.kind) {
          case "ok":
            return result.user;
          case "invalid_credentials":
          case "locked_out":
            // Locked-out and plain-wrong-credentials both surface as NextAuth's generic
            // CredentialsSignin here, same as before this was extracted into
            // verifyCredentials — the web sign-in form has never distinguished the two.
            return null;
          case "two_factor_required":
            throw result.method === "TOTP" ? new TwoFactorRequiredTotpError() : new TwoFactorRequiredEmailError();
          case "invalid_two_factor_code":
            throw new InvalidTwoFactorCodeError();
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) return false;
        // Closed beta: Google can only sign an *existing* account back in, never mint a new
        // one — without this check, Google was effectively an ungated signup path around the
        // closed "Create account" flow on the sign-in page (see sign-in-card.tsx).
        const existing = await prisma.user.findUnique({ where: { email: user.email } });
        if (!existing) return false;
        await prisma.user.update({
          where: { email: user.email },
          data: {
            name: user.name ?? undefined,
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
    async jwt({ token, user, trigger, session }) {
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
        });
        if (dbUser) {
          token.id = dbUser.id;
        }
      }
      // Lets the profile-update server action refresh the display name in this session's
      // JWT (via updateSession()) without requiring a full sign-out/sign-in.
      if (trigger === "update" && session?.user?.name) {
        token.name = session.user.name;
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
