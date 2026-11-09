import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-wrap site-footer-inner">
        <Link href="/" className="site-brand site-footer-brand">
          <BrandMark className="site-brand-mark" />
          <span className="site-brand-text">
            <span className="site-brand-name serif">Van der Tweel</span>
            <span className="site-brand-sub">Bali &middot; Development atelier</span>
          </span>
        </Link>

        <nav className="site-footer-links" aria-label="Footer">
          <Link href="/atelier">The atelier</Link>
          <Link href="/ownership">Ownership</Link>
          <Link href="/villas">Villas</Link>
          <Link href="/contact">Contact</Link>
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
