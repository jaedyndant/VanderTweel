import Link from "next/link";
import type { ReactNode } from "react";
import { clientSans, clientSerif } from "@/fonts";
import "./login.css";

export function LoginShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main
      className={`login-page ${clientSans.variable} ${clientSerif.variable}`}
      lang="en"
    >
      <header className="login-header">
        <Link className="login-brand" href="/" aria-label="Van der Tweel website">
          <span className="login-brand-mark" aria-hidden="true" />
          <span>Van der Tweel</span>
        </Link>
        <span className="login-header-label">Project portal</span>
      </header>

      <div className="login-body">
        <section className="login-panel" aria-labelledby="login-heading">
          <p className="login-eyebrow">Your project portal</p>
          <h1 id="login-heading">{title}</h1>
          {children}
        </section>
      </div>

      <footer className="login-footer">
        <Link href="/">
          <span aria-hidden="true">←</span> Back to website
        </Link>
        <span>Van der Tweel</span>
      </footer>
    </main>
  );
}
