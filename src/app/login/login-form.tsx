"use client";

import { useRef, useState, type FormEvent } from "react";
import { requestLoginLink } from "./request-login-link";

const REQUEST_ERROR =
  "We could not confirm your request. Check your email address and try again. If this continues, contact your project team.";

// Email/magic-link only. Existing server authorization selects the role;
// neither a role picker nor an account-existence claim belongs in this form.
export function LoginForm({
  callbackUrl,
  initialError = false,
}: {
  callbackUrl: string;
  initialError?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState(initialError ? REQUEST_ERROR : null);
  const submitting = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || accepted) return;
    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      const confirmed = await requestLoginLink(email, callbackUrl);
      if (confirmed) setAccepted(true);
      else setError(REQUEST_ERROR);
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <>
      <p>Enter your email address to request a sign-in link.</p>
      <form onSubmit={submit} aria-busy={pending}>
        <label htmlFor="login-email">Email address</label>
        <input
          id="login-email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          readOnly={pending || accepted}
          onChange={(event) => setEmail(event.target.value)}
          aria-describedby={error ? "login-error" : undefined}
        />
        {error ? (
          <p id="login-error" className="login-error" role="alert">
            {error}
          </p>
        ) : null}
        {accepted ? (
          <div className="login-accepted" role="status">
            <p>
              Request received. If this address can sign in, you will receive a
              sign-in link. Check your spam folder too.
            </p>
            <button
              type="button"
              onClick={() => {
                setAccepted(false);
                setError(null);
              }}
            >
              Use another email address
            </button>
          </div>
        ) : (
          <button type="submit" disabled={pending}>
            {pending ? "Requesting sign-in link…" : "Send sign-in link"}
          </button>
        )}
      </form>
    </>
  );
}
