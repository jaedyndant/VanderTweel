"use client";

// TO 11.3 / MS2: a runtime error on /koper or /office must never show a raw
// stack trace to Max, a PM, or a buyer — and it must still reach Sentry.
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body style={{ padding: 32, fontFamily: "system-ui" }}>
        <h1>Er is iets misgegaan</h1>
        <p>Dit is gemeld. Probeer de pagina te verversen.</p>
      </body>
    </html>
  );
}
