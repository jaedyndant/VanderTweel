import Link from "next/link";
import Reveal from "@/components/site/reveal";
import VillaCard from "@/components/site/villa-card";
import { SITE_IMAGES, unsplash } from "@/components/site/images";
import { getPublicVillas } from "@/lib/public-site-data";

export default async function HomePage() {
  const villas = await getPublicVillas();
  const villaImages = [SITE_IMAGES.poolVillaWide, SITE_IMAGES.tropicalHouse];

  return (
    <>
      <section className="site-hero">
        <div className="site-wrap site-hero-grid">
          <Reveal as="header">
            <p className="site-eyebrow">
              Cemagi, Bali <span className="muted">/ A collection of two</span>
            </p>
            <h1 className="site-h1">
              A quieter way
              <br />
              to call Bali <span className="italic-accent">home.</span>
            </h1>
            <p className="site-lede">
              Thoughtfully crafted villas. A personal approach to ownership.
              And a clear view of every step along the way.
            </p>
            <div className="site-cta-row">
              <Link href="/villas" className="site-btn site-btn-primary">
                Explore Cemagi Atelier ↓
              </Link>
              <Link href="/contact" className="site-btn site-btn-outline">
                Arrange a viewing ↗
              </Link>
            </div>
          </Reveal>

          <Reveal className="site-hero-media" delay={120}>
            <span className="site-hero-tag">Cemagi Atelier — Collection 01</span>
            <img
              src={unsplash(SITE_IMAGES.heroVilla, { w: 1200 })}
              alt="Modern tropical villa with infinity pool at dusk, Bali"
            />
          </Reveal>
        </div>
      </section>

      <section className="site-section">
        <div className="site-wrap site-grid-2">
          <Reveal className="site-media">
            <img
              src={unsplash(SITE_IMAGES.interiorLounge, { w: 1000 })}
              alt="Open-plan living space with natural materials"
            />
          </Reveal>
          <Reveal delay={100}>
            <p className="site-eyebrow">01 / The architecture</p>
            <h2 className="site-h2">Considered in every detail.</h2>
            <p className="site-body">
              A small collection, grounded in the textures of Bali. Calm
              interiors meet intimate outdoor spaces — sculpted concrete,
              Sukabumi stone and warm teak, with open living that creates an
              easy rhythm between indoors and out.
            </p>
            <div style={{ marginTop: 24 }}>
              <Link href="/atelier" className="site-btn site-btn-outline">
                Walk through the atelier ↗
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="site-section">
        <div className="site-wrap">
          <Reveal>
            <p className="site-eyebrow">02 / The collection</p>
            <h2 className="site-h2">Two residences, under construction now.</h2>
            <p className="site-body" style={{ maxWidth: "56ch" }}>
              Every villa in the Cemagi Atelier collection is tracked from
              first foundation to handover — these are the two currently in
              build.
            </p>
          </Reveal>
          <Reveal delay={100} className="site-villa-grid" as="div">
            <div className="site-villa-grid" style={{ marginTop: 32, width: "100%" }}>
              {villas.map((villa, i) => (
                <VillaCard key={villa.id} villa={villa} image={villaImages[i % villaImages.length]} />
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="site-section site-section-dark">
        <div className="site-wrap site-cta-band">
          <Reveal>
            <p className="site-eyebrow">Let&rsquo;s meet</p>
            <h2 className="site-h2">Begin with a conversation.</h2>
            <p className="site-body" style={{ maxWidth: "46ch" }}>
              Walk the site, explore the details, or simply ask a question.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <Link href="/contact" className="site-btn site-btn-paper">
              Arrange a viewing ↗
            </Link>
            <p className="note">
              No fees to ask a question. We reply within one business day.
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
