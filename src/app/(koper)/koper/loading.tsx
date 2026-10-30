export default function ClientLoading() {
  return (
    <main className="client-route-state" aria-busy="true" aria-live="polite">
      <section>
        <p className="client-state-eyebrow">Van der Tweel · Owner platform</p>
        <h2>A moment for your residence.</h2>
        <p>Loading your latest project information.</p>
        <div className="client-state-placeholder" aria-hidden="true" />
      </section>
    </main>
  );
}
