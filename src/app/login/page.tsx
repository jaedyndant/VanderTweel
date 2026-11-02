"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

// TO 9.1: email/magic-link only, no password field, no role picker on this
// screen — the role is decided server-side from the pre-seeded account.
//
// Uses next-auth/react's signIn() instead of a hand-rolled fetch: a raw POST
// to /api/auth/signin/resend requires the Auth.js CSRF cookie to already be
// set, but GET /login never set it, so every real submission failed with
// MissingCSRF server-side while this page still showed "check your email"
// unconditionally -- a false-positive success with no email ever sent
// (found via a real Resend-sandbox delivery test, 2026-11-02). signIn()
// fetches /api/auth/csrf itself before posting, and its result tells us
// whether the send actually succeeded.
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await signIn("resend", { email, redirect: false, callbackUrl: "/" });
    setSubmitting(false);
    if (!result || result.error) {
      setError("Inloggen is niet gelukt. Controleer het e-mailadres en probeer het opnieuw.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <main style={{ padding: 32, fontFamily: "system-ui" }}>
        <p>Check je e-mail voor de inloglink.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 32, fontFamily: "system-ui", maxWidth: 360 }}>
      <h1>Inloggen</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          required
          placeholder="E-mailadres"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 12 }}
        />
        <button type="submit" disabled={submitting} style={{ width: "100%", padding: 8 }}>
          {submitting ? "Versturen..." : "Stuur inloglink"}
        </button>
        {error && <p style={{ color: "#b91c1c", marginTop: 12 }}>{error}</p>}
      </form>
    </main>
  );
}
