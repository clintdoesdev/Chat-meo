import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export default {
  providers: [Google],
  pages: {
    signIn: "/signin",
  },
  trustHost: true,
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isAppRoute = request.nextUrl.pathname.startsWith("/app");

      if (!isAppRoute) return true;
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
