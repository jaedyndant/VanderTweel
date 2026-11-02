import { signIn } from "next-auth/react";
import { safeLoginCallback } from "./login-routing";

/** The Auth.js client supplies its CSRF token and interprets the response URL.
 * HTTP 200 alone is not success: Auth.js can return an error redirect with 200.
 * Acceptance here is not proof that the message reached an inbox.
 */
export async function requestLoginLink(
  email: string,
  callbackUrl: string,
): Promise<boolean> {
  try {
    const result = await signIn("resend", {
      email: email.trim(),
      redirect: false,
      redirectTo: safeLoginCallback(callbackUrl) ?? "/login",
    });
    return result?.ok === true && !result.error;
  } catch {
    return false;
  }
}
