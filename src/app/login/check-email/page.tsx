import type { Metadata } from "next";
import Link from "next/link";
import { LoginShell } from "../login-shell";

export const metadata: Metadata = {
  title: "Check your email · Van der Tweel",
  robots: { index: false, follow: false },
};

export default function CheckEmailPage() {
  return (
    <LoginShell title="Check your email">
      <p className="login-intro">
        If this address can sign in, you will receive a sign-in link. Check your
        spam folder too.
      </p>
      <p className="login-return">
        <Link className="login-primary" href="/login">
          Back to sign in
        </Link>
      </p>
    </LoginShell>
  );
}
