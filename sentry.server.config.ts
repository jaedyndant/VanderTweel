import * as Sentry from "@sentry/nextjs";

// MS2 Step 9. No real Sentry project/DSN exists yet — this initializes
// cleanly and no-ops (SDK docs: undefined dsn disables the SDK) rather than
// silently doing nothing or crashing. Set SENTRY_DSN in Vercel once a real
// Sentry project is created to turn this on for real.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.VERCEL_ENV ?? "development",
});
