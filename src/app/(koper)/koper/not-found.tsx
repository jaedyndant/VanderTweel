import Link from "next/link";

export default function ClientNotFound() {
  return (
    <main className="client-route-state">
      <section aria-labelledby="client-not-found-title">
        <p className="client-state-eyebrow">Van der Tweel · Owner platform</p>
        <h1 id="client-not-found-title">This residence is not available.</h1>
        <p>
          It may not be linked to your account. Return to your overview to view
          your own residence.
        </p>
        <Link href="/koper">
          Your overview <span aria-hidden="true"> ↗</span>
        </Link>
      </section>
    </main>
  );
}
