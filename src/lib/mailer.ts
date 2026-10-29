// Thin wrapper around the Resend REST API (no SDK dependency, mirrors the
// same HTTP call the auth magic-link provider makes under the hood).
// Kept separate from notify.ts so tests can inject a fake instead of this
// real network call -- notify.ts's own tests never hit the network.

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
};

export async function sendEmail({ to, subject, text }: SendEmailInput): Promise<void> {
  const apiKey = process.env.AUTH_RESEND_KEY;
  const from = process.env.AUTH_EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error("AUTH_RESEND_KEY / AUTH_EMAIL_FROM not configured");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, text }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend send failed (${res.status}): ${body.slice(0, 300)}`);
  }
}
