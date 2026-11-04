import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { account } from "@/db/schema";
import { authConfig } from "@/lib/auth-config";
import { buildAuthAdapter, isKnownAccountEmail, getAccountRole } from "@/lib/auth-adapter";
import { localMailCaptureEnabled, sendEmail } from "@/lib/mailer";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: buildAuthAdapter(),
  providers: [Resend({
    apiKey: process.env.AUTH_RESEND_KEY,
    from: process.env.AUTH_EMAIL_FROM,
    // Captures only delivery on explicitly isolated local fixtures. The real
    // Auth.js token, expiry, one-time consumption and CSRF flow remain intact.
    ...(localMailCaptureEnabled() ? { sendVerificationRequest: async ({ identifier, url }: { identifier: string; url: string }) => {
      await sendEmail({ to: identifier, subject: "Sign in to Van der Tweel", text: url });
    } } : {}),
  })],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) { return !!user.email && isKnownAccountEmail(user.email); },
    async jwt({ token, user }) {
      if (user?.email) {
        const role = await getAccountRole(user.email);
        if (role) token.role = role;
        token.accountId = user.id;
        await db.update(account).set({ lastLoginAt: new Date() }).where(eq(account.id, user.id!));
      }
      return token;
    },
  },
});
