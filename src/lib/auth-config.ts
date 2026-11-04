import type { NextAuthConfig } from "next-auth";
// Edge-safe. The PostgreSQL adapter is loaded only in the Node auth handler.
export const authConfig = {
  providers: [],
  session: { strategy: "jwt" },
  cookies: { sessionToken: {
    name: process.env.NODE_ENV === "production" ? "__Secure-authjs.session-token" : "authjs.session-token",
    options: { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" },
  } },
  pages: { signIn: "/login", verifyRequest: "/login/check-email" },
  callbacks: { async session({ session, token }) {
    if (token.role) (session.user as typeof session.user & { role: string }).role = token.role as string;
    if (token.accountId) session.user.id = token.accountId as string;
    return session;
  } },
} satisfies NextAuthConfig;
