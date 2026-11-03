import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { buildAuthAdapter, isKnownAccountEmail, getAccountRole } from "@/lib/auth-adapter";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: buildAuthAdapter(),
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.AUTH_EMAIL_FROM,
    }),
  ],
  // JWT, not "database": middleware runs on every /koper and /office request
  // in the Edge runtime, and a database session strategy means middleware
  // does a Postgres round trip (via the Neon HTTP driver) on every single
  // request. In production that surfaced as real HANGING_PROMISE_REJECTION /
  // AdapterError failures under normal traffic. JWT keeps the session (role +
  // id) signed into the cookie after the one DB read at sign-in, so
  // middleware never touches the database again until the token expires.
  session: { strategy: "jwt" },
  // Explicit rather than relying on NextAuth v5 (beta) defaults, so a future
  // dependency bump can't silently change cookie security under us.
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-authjs.session-token"
          : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/login/check-email",
  },
  callbacks: {
    // TO 9.1: no self-registration. Reject the sign-in attempt itself (so no
    // magic link is ever sent, and no verification-token row is created) when
    // the email has no pre-seeded account. Defense in depth alongside the
    // adapter's own createUser() throw.
    async signIn({ user }) {
      if (!user.email) return false;
      return isKnownAccountEmail(user.email);
    },
    // Only runs the DB lookup on the initial sign-in (when `user` is
    // present, right after the magic link is consumed). Every later request
    // just decodes the already-signed token — no DB call, so middleware
    // reading the session is DB-free.
    async jwt({ token, user }) {
      if (user?.email) {
        const role = await getAccountRole(user.email);
        if (role) token.role = role;
        token.accountId = user.id;
      }
      return token;
    },
    async session({ session: sessionPayload, token }) {
      if (token.role) {
        (sessionPayload.user as typeof sessionPayload.user & { role: string }).role =
          token.role as string;
      }
      if (token.accountId) {
        (sessionPayload.user as typeof sessionPayload.user & { id: string }).id =
          token.accountId as string;
      }
      return sessionPayload;
    },
  },
});
