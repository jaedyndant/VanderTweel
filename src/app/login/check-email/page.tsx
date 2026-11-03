import type { Metadata } from "next";
import Link from "next/link";
import "../login.css";

export const metadata: Metadata = {
  title: "Check your email · Van der Tweel",
  robots: { index: false, follow: false },
};

export default function CheckEmailPage() {
  return (
    <main className="login-page" lang="en">
      <h1>Check your email</h1>
      <p>
        If this address can sign in, you will receive a sign-in link. Check your
        spam folder too.
      </p>
      <p className="login-return">
        <Link href="/login">Back to sign in</Link>
      </p>
    </main>
  );
}
