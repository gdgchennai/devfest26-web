import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { upsertUserByGoogle } from "@/lib/users";

/**
 * Auth.js (NextAuth v5) — Google sign-in only.
 *
 * Session strategy is JWT: we never store sessions in D1, only accounts. On
 * first sign-in the `jwt` callback creates the `users` row (or matches an
 * existing one by Google `sub`) and stamps our own opaque `uid` onto the
 * token, so every request downstream reads `session.user.uid` — our handle,
 * never Google's.
 *
 * Credentials come from env: AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET
 * (`.env.local` in dev, Worker secrets in production). `trustHost` because we
 * run on Cloudflare, not a platform Auth.js auto-detects.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile?.sub) {
        const user = await upsertUserByGoogle({
          sub: profile.sub,
          email: profile.email ?? null,
          name: profile.name ?? null,
          image: typeof profile.picture === "string" ? profile.picture : null,
        });
        token.uid = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid && session.user) {
        session.user.uid = token.uid as string;
      }
      return session;
    },
  },
});
