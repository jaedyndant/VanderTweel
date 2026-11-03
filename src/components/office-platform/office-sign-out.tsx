"use client";

import { useActionState, useId } from "react";
import { submitOfficeSignOut } from "./sign-out";

export function OfficeSignOut() {
  const [error, formAction, pending] = useActionState(submitOfficeSignOut, null);
  const errorId = useId();

  return (
    <form action={formAction} className="op-signout" aria-busy={pending}>
      <button
        type="submit"
        className="op-btn op-btn-light op-signout-button"
        disabled={pending}
        aria-describedby={error ? errorId : undefined}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 4H4v16h5M9 12h11m-4-4 4 4-4 4" />
        </svg>
        <span aria-live="polite">{pending ? "Signing out…" : "Sign out"}</span>
      </button>
      {error ? (
        <p id={errorId} role="alert" className="op-signout-error">
          {error}
        </p>
      ) : null}
    </form>
  );
}
