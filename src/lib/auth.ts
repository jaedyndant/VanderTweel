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
  session: { strategy: "database" },
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
    // Stamp the account's role (and id, for MS3's per-buyer data scoping) onto
    // the session so every surface/middleware check has it without a second
    // DB round trip per request.
    async session({ session: sessionPayload, user }) {
      if (sessionPayload.user?.email) {
        const role = await getAccountRole(sessionPayload.user.email);
        if (role) {
          (sessionPayload.user as typeof sessionPayload.user & { role: string }).role = role;
        }
      }
      if (user?.id) {
        (sessionPayload.user as typeof sessionPayload.user & { id: string }).id = user.id;
      }
      return sessionPayload;
    },
  },
});
