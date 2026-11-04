"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/atelier", label: "The atelier" },
  { href: "/ownership", label: "Ownership" },
  { href: "/villas", label: "Villas" },
];

export default function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="site-nav">
      <div className="site-wrap site-nav-inner">
        <Link href="/" className="site-brand" onClick={() => setOpen(false)}>
          <svg
            viewBox="0 0 28 28"
            className="site-brand-mark"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M6 22V13c0-4.4 3.6-8 8-8s8 3.6 8 8v9"
              stroke="currentColor"
              strokeWidth="1.6"
            />
          </svg>
          <span className="site-brand-text">
            <span className="site-brand-name serif">Van der Tweel</span>
            <span className="site-brand-sub">Bali &middot; Development atelier</span>
          </span>
        </Link>

        <nav className="site-nav-links" aria-label="Primary">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
          <Link href="/login">Owner portal ↗</Link>
          <Link href="/contact" className="site-nav-cta">
            Arrange a viewing ↗
          </Link>
        </nav>

        <button
          type="button"
          className="site-nav-toggle"
          aria-expanded={open}
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      <div className={`site-wrap site-nav-mobile ${open ? "is-open" : ""}`}>
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
            {link.label}
          </Link>
        ))}
        <Link href="/login" onClick={() => setOpen(false)}>
          Owner portal ↗
        </Link>
        <Link href="/contact" onClick={() => setOpen(false)}>
          Arrange a viewing ↗
        </Link>
      </div>
    </header>
  );
}
