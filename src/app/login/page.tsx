"use client";

import { useState } from "react";

// TO 9.1: email/magic-link only, no password field, no role picker on this
// screen — the role is decided server-side from the pre-seeded account.
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/auth/signin/resend", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email, callbackUrl: "/" }),
    });
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
        <button type="submit" style={{ width: "100%", padding: 8 }}>
          Stuur inloglink
        </button>
      </form>
    </main>
  );
}
