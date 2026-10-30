export default function OfficeLoading() {
  return (
    <main className="office-route-state" aria-busy="true" aria-live="polite">
      <section>
        <p className="office-state-eyebrow">Van der Tweel · Development office</p>
        <h2>A moment for your development.</h2>
        <p>Loading your latest project information.</p>
        <div className="office-state-placeholder" aria-hidden="true" />
      </section>
    </main>
  );
}
