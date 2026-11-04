import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Reveal from "@/components/site/reveal";
import { SITE_IMAGES, unsplash } from "@/components/site/images";
import { getPublicVillaBySlug } from "@/lib/public-site-data";

// Deliberately no generateStaticParams: the villa collection is read live
// from Postgres on every request (see (site)/layout.tsx `instant = false`),
// so this route must never attempt a build-time DB read — a CI/preview
// build must succeed without real database credentials.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const villa = await getPublicVillaBySlug(slug);
  if (!villa) return { title: "Villa" };
  return {
    title: `${villa.code} · ${villa.typeLabel ?? "Villa"}`,
    description: `${villa.code} at Cemagi Atelier — ${villa.typeLabel}, ${villa.plotM2}m² plot.`,
  };
}

const STATUS_LABEL: Record<string, string> = {
  on_schedule: "On schedule",
  planned: "Planned",
  delayed: "Delayed",
  complete: "Complete",
};

function formatHandover(iso: string | null): string {
  if (!iso) return "To be confirmed";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export default async function VillaDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const villa = await getPublicVillaBySlug(slug);
  if (!villa) notFound();

  const heroImage =
    villa.code === "Villa 1" ? SITE_IMAGES.poolVillaWide : SITE_IMAGES.tropicalHouse;

  return (
    <>
      <section className="site-hero">
        <div className="site-wrap site-hero-grid">
          <Reveal as="header">
            <p className="site-eyebrow">
              Cemagi Atelier <span className="muted">/ {villa.code}</span>
            </p>
            <h1 className="site-h1">{villa.typeLabel ?? villa.code}</h1>
            <p className="site-lede">
              {villa.plotM2}m&sup2; plot &middot; {villa.builtM2}m&sup2; built
              &middot; {villa.outdoorM2}m&sup2; outdoor living.
            </p>
            <div className="site-spec-list">
              <div className="site-spec-row">
                <span className="label">Status</span>
                <span className="value">{STATUS_LABEL[villa.status] ?? villa.status}</span>
              </div>
              <div className="site-spec-row">
                <span className="label">Lease term</span>
                <span className="value">{villa.leaseYears} years</span>
              </div>
              <div className="site-spec-row">
                <span className="label">Package</span>
                <span className="value">{villa.pricePackage}</span>
              </div>
              <div className="site-spec-row">
                <span className="label">Expected handover</span>
                <span className="value">{formatHandover(villa.handoverExpected)}</span>
              </div>
              <div className="site-spec-row">
                <span className="label">Price</span>
                <span className="value">
                  {villa.priceTotalUsd
                    ? `$${villa.priceTotalUsd.toLocaleString("en-US")} USD`
                    : "On request"}
                </span>
              </div>
            </div>
            <div className="site-cta-row">
              <Link href="/contact" className="site-btn site-btn-primary">
                Arrange a viewing ↗
              </Link>
              <Link href="/villas" className="site-btn site-btn-outline">
                Back to the collection
              </Link>
            </div>
          </Reveal>

          <Reveal className="site-hero-media" delay={120}>
            <span className="site-hero-tag">{villa.code}</span>
            <img
              src={unsplash(heroImage, { w: 1200 })}
              alt={`${villa.code} exterior with pool`}
            />
          </Reveal>
        </div>
      </section>

      <section className="site-section">
        <div className="site-wrap site-grid-2">
          <Reveal className="site-media">
            <img
              src={unsplash(SITE_IMAGES.interiorLiving, { w: 1000 })}
              alt={`${villa.code} interior living space`}
            />
          </Reveal>
          <Reveal delay={100}>
            <p className="site-eyebrow">Finishes</p>
            <h2 className="site-h2">Natural materials, lasting character.</h2>
            <p className="site-body">
              Sculpted concrete, Sukabumi stone and warm teak throughout, with
              full-height glazing opening the living spaces to a private
              garden and plunge pool.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="site-section site-section-dark">
        <div className="site-wrap site-cta-band">
          <Reveal>
            <h2 className="site-h2">Follow {villa.code}&rsquo;s progress.</h2>
            <p className="site-body" style={{ maxWidth: "46ch" }}>
              Owners see live construction updates, payment milestones and
              documents in their private owner platform.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <Link href="/login" className="site-btn site-btn-paper">
              Owner portal ↗
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
