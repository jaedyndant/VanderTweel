"use client";

export default function OfficeError({ retry }: { retry: () => void }) {
  return (
    <main className="office-route-state">
      <section aria-labelledby="office-error-title">
        <p className="office-state-eyebrow">Van der Tweel · Development office</p>
        <h1 id="office-error-title">Let’s try that again.</h1>
        <p>
          Your project information could not be loaded. Please try again in a
          moment.
        </p>
        <button type="button" onClick={retry}>
          Try again <span aria-hidden="true"> ↗</span>
        </button>
      </section>
    </main>
  );
}
