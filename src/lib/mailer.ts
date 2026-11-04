import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type SendEmailInput = { to: string; subject: string; text: string; idempotencyKey?: string };
export function localMailCaptureEnabled() {
  if (process.env.MAIL_TRANSPORT !== "local-capture") return false;
  const dbUrl = new URL(process.env.DATABASE_URL ?? "postgres://invalid");
  const appUrl = new URL(process.env.APP_URL ?? "https://invalid");
  if (process.env.NODE_ENV === "production" || process.env.VDT_LOCAL_TEST !== "1" || !["127.0.0.1", "localhost"].includes(dbUrl.hostname) || !["127.0.0.1", "localhost"].includes(appUrl.hostname)) throw new Error("Local capture requires an isolated development database and origin.");
  return true;
}
export async function sendEmail({ to, subject, text, idempotencyKey }: SendEmailInput): Promise<void> {
  if (localMailCaptureEnabled()) {
    const dir = process.env.LOCAL_MAIL_DIR;
    if (!dir || !path.resolve(dir).startsWith("/tmp/vdt-")) throw new Error("Local mail directory is not configured.");
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const key = idempotencyKey ? createHash("sha256").update(idempotencyKey).digest("hex") : randomUUID();
    try { await writeFile(path.join(dir, `${key}.json`), JSON.stringify({ to, subject, text, at: new Date().toISOString() }), { flag: "wx", mode: 0o600 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    return;
  }
  const apiKey = process.env.AUTH_RESEND_KEY;
  const from = process.env.AUTH_EMAIL_FROM;
  if (!apiKey || !from) throw new Error("mail_not_configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", signal: AbortSignal.timeout(12_000),
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
    body: JSON.stringify({ from, to, subject, text }),
  });
  if (!response.ok) throw new Error(`mail_provider_${response.status}`);
}
