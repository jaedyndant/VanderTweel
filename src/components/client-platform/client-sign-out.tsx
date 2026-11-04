"use client";

import { useActionState, useId } from "react";
import { ClientIcon } from "./client-icon";
import { submitClientSignOut } from "./sign-out";

export function ClientSignOut() {
  const [error, action, pending] = useActionState(submitClientSignOut, null);
  const errorId = useId();
  return (
    <form action={action} className="client-signout" aria-busy={pending}>
      <button
        type="submit"
        className="btn light"
        disabled={pending}
        aria-describedby={error ? errorId : undefined}
      >
        <ClientIcon name="sign-out" />
        <span aria-live="polite">{pending ? "Signing out…" : "Sign out"}</span>
      </button>
      {error ? (
        <p id={errorId} className="client-signout-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
