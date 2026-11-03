import { unstable_rethrow } from "next/navigation";
import { signOutAction } from "@/lib/client-platform-actions";

/** Keep Auth.js session invalidation and Next's redirect together. A failed
 * request must leave a retryable control, not pretend the user signed out.
 */
export async function submitOfficeSignOut(): Promise<string | null> {
  try {
    await signOutAction();
    return null;
  } catch (error) {
    // Successful server-action redirects are framework control flow.
    unstable_rethrow(error);
    return "Could not sign out. Please try again.";
  }
}
