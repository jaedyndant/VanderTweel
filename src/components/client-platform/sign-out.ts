import { unstable_rethrow } from "next/navigation";
import { signOutAction } from "@/lib/client-platform-actions";

export async function submitClientSignOut(): Promise<string | null> {
  try {
    await signOutAction();
    return null;
  } catch (error) {
    // Next's successful redirect is control flow, not a failed sign-out.
    unstable_rethrow(error);
    return "Could not sign out. Please try again.";
  }
}
