"use client";

import { useRef, useState, type FormEvent } from "react";
import { requestLoginLink } from "./request-login-link";

const REQUEST_ERROR =
  "De aanvraag kon niet worden bevestigd. Controleer het e-mailadres en probeer opnieuw. Blijft dit gebeuren, neem dan contact op met de beheerder.";

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
      <p>Gebruik je e-mailadres om een inloglink aan te vragen.</p>
      <form onSubmit={submit} aria-busy={pending}>
        <label htmlFor="login-email">E-mailadres</label>
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
              Aanvraag ontvangen. Als aanmelden voor dit adres mogelijk is,
              ontvang je een inloglink. Controleer ook je spammap.
            </p>
            <button
              type="button"
              onClick={() => {
                setAccepted(false);
                setError(null);
              }}
            >
              Ander e-mailadres gebruiken
            </button>
          </div>
        ) : (
          <button type="submit" disabled={pending}>
            {pending ? "Inloglink aanvragen…" : "Stuur inloglink"}
          </button>
        )}
      </form>
    </>
  );
}
