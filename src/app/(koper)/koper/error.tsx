"use client";

export default function ClientError({ retry }: { retry: () => void }) {
  return (
    <main className="client-route-state">
      <section aria-labelledby="client-error-title">
        <p className="client-state-eyebrow">Van der Tweel · Owner platform</p>
        <h1 id="client-error-title">Let’s try that again.</h1>
        <p>
          Your residence information could not be loaded. Please try again in a
          moment.
        </p>
        <button type="button" onClick={retry}>
          Try again <span aria-hidden="true"> ↗</span>
        </button>
      </section>
    </main>
  );
}
