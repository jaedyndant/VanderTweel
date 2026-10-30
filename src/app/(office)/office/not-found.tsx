import Link from "next/link";

export default function OfficeNotFound() {
  return (
    <main className="office-route-state">
      <section aria-labelledby="office-not-found-title">
        <p className="office-state-eyebrow">Van der Tweel · Development office</p>
        <h1 id="office-not-found-title">This page is not available.</h1>
        <p>
          Return to your overview to view the projects and records available to
          your account.
        </p>
        <Link href="/office">
          Your overview <span aria-hidden="true"> ↗</span>
        </Link>
      </section>
    </main>
  );
}
