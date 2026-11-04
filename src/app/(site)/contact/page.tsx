import type { Metadata } from "next";
import Reveal from "@/components/site/reveal";

export const metadata: Metadata = {
  title: "Arrange a viewing",
  description: "Get in touch with Van der Tweel about the Cemagi Atelier collection.",
};

const CONTACT_EMAIL = "hello@vandertweel.com";

export default function ContactPage() {
  return (
    <section className="site-hero">
      <div className="site-wrap" style={{ maxWidth: 640 }}>
        <Reveal as="header">
          <p className="site-eyebrow">Let&rsquo;s meet</p>
          <h1 className="site-h1">Begin with a conversation.</h1>
          <p className="site-lede">
            Walk the site, explore the details, or simply ask a question.
            We reply within one business day.
          </p>
        </Reveal>

        <Reveal delay={100}>
          <div className="site-spec-list" style={{ marginTop: 32 }}>
            <div className="site-spec-row">
              <span className="label">Email</span>
              <a className="value" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
            </div>
            <div className="site-spec-row">
              <span className="label">Response time</span>
              <span className="value">Within one business day</span>
            </div>
          </div>

          <div className="site-cta-row">
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
                "Arrange a viewing — Cemagi Atelier",
              )}`}
              className="site-btn site-btn-primary"
            >
              Email us to arrange a viewing ↗
            </a>
          </div>

          <p className="site-body" style={{ marginTop: 24, fontSize: 14, color: "var(--muted)" }}>
            Already an owner? Sign in to your{" "}
            <a href="/login" style={{ color: "var(--teak)", fontWeight: 600 }}>
              owner portal
            </a>{" "}
            for live updates on your residence.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
