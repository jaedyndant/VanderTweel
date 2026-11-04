import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-wrap site-footer-inner">
        <div>
          <div className="site-brand-name serif" style={{ fontSize: 18 }}>
            Van der Tweel
          </div>
          <div className="site-brand-sub" style={{ color: "var(--muted)" }}>
            Bali &middot; Development atelier
          </div>
        </div>

        <nav className="site-footer-links" aria-label="Footer">
          <Link href="/atelier">The atelier</Link>
          <Link href="/ownership">Ownership</Link>
          <Link href="/villas">Villas</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/login">Owner portal ↗</Link>
        </nav>

        <div className="site-footer-fine">
          &copy; 2026 Van der Tweel &middot; Cemagi Atelier
          <br />
          Photography is illustrative.
        </div>
      </div>
    </footer>
  );
}
