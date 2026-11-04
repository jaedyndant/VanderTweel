import Link from "next/link";
import type { Metadata } from "next";
import Reveal from "@/components/site/reveal";
import { SITE_IMAGES, unsplash } from "@/components/site/images";

export const metadata: Metadata = {
  title: "Ownership",
  description:
    "A personal approach to ownership — from first viewing to your private owner platform.",
};

const STEPS = [
  {
    n: "01",
    title: "Meet the place",
    body: "Visit in person or explore the villa with a video consultation.",
  },
  {
    n: "02",
    title: "Understand the details",
    body: "Review the specification, independent legal advice and agreed milestones.",
  },
  {
    n: "03",
    title: "Follow the journey",
    body: "See updates, records and milestones in your personal owner platform.",
  },
];

export default function OwnershipPage() {
  return (
    <>
      <section className="site-hero">
        <div className="site-wrap">
          <Reveal as="header">
            <p className="site-eyebrow">02 / Ownership</p>
            <h1 className="site-h1">A personal approach to ownership.</h1>
            <p className="site-lede">
              From your first conversation to handover, every step is
              explained plainly and tracked in one place.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="site-section">
        <div className="site-wrap site-steps">
          {STEPS.map((step, i) => (
            <Reveal key={step.n} className="site-step" delay={i * 90}>
              <div className="num serif">{step.n}</div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="site-section site-section-dark">
        <div className="site-wrap site-grid-2">
          <Reveal>
            <p className="site-eyebrow">03 / Your owner platform</p>
            <h2 className="site-h2">Far from Bali. Close to your home.</h2>
            <p className="site-body">
              Follow construction, browse the latest updates and keep your
              documents in one calm, organized space — built specifically for
              Van der Tweel owners.
            </p>
            <div className="site-cta-row">
              <Link href="/login" className="site-btn site-btn-paper">
                Owner portal ↗
              </Link>
            </div>
          </Reveal>
          <Reveal delay={100} className="site-media">
            <img
              src={unsplash(SITE_IMAGES.houseExterior, { w: 1000 })}
              alt="Villa under construction with completed roof structure"
            />
          </Reveal>
        </div>
      </section>

      <section className="site-section">
        <div className="site-wrap site-cta-band">
          <Reveal>
            <p className="site-eyebrow">Let&rsquo;s meet</p>
            <h2 className="site-h2">Begin with a conversation.</h2>
            <p className="site-body" style={{ maxWidth: "46ch" }}>
              Walk the site, explore the details, or simply ask a question.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <Link href="/contact" className="site-btn site-btn-primary">
              Arrange a viewing ↗
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
