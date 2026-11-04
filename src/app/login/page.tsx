import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { LoginShell } from "./login-shell";
import {
  authenticatedLoginDestination,
  safeLoginCallback,
} from "./login-routing";

export const metadata: Metadata = {
  title: "Sign in · Van der Tweel",
  robots: { index: false, follow: false },
};

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Session cookies and searchParams are request-time data. Keep them below
// Suspense with cacheComponents enabled, never in a shared cached function.
async function LoginContent({ searchParams }: LoginPageProps) {
  // Auth.js may generate CSRF randomness before reading cookies. Defer the
  // entire call until a real request, not merely the eventual cookie read.
  await connection();
  const [session, query] = await Promise.all([auth(), searchParams]);
  const callback = safeLoginCallback(query.callbackUrl);
  const role = (session?.user as { role?: unknown } | undefined)?.role;
  const destination = authenticatedLoginDestination(role, callback);
  if (destination) redirect(destination);

  return (
    <LoginForm
      callbackUrl={callback ?? "/login"}
      initialError={Boolean(query.error)}
    />
  );
}

export default function LoginPage(props: LoginPageProps) {
  return (
    <LoginShell title="Sign in">
      <Suspense
        fallback={
          <p className="login-loading" role="status">
            Preparing sign-in…
          </p>
        }
      >
        <LoginContent {...props} />
      </Suspense>
    </LoginShell>
  );
}
