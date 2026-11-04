import Link from "next/link";
import type { Metadata } from "next";
import Reveal from "@/components/site/reveal";
import { SITE_IMAGES, unsplash } from "@/components/site/images";

export const metadata: Metadata = {
  title: "The atelier",
  description:
    "Natural materials, lasting character: the design direction behind Cemagi Atelier.",
  openGraph: {
    title: "The atelier · Van der Tweel",
    description:
      "Natural materials, lasting character: the design direction behind Cemagi Atelier.",
    url: "/atelier",
    images: [
      {
        url: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80",
      },
    ],
  },
};

export default function AtelierPage() {
  return (
    <>
      <section className="site-hero">
        <div className="site-wrap">
          <Reveal as="header">
            <p className="site-eyebrow">01 / The architecture</p>
            <h1 className="site-h1">Considered in every detail.</h1>
            <p className="site-lede">
              A small collection, grounded in the textures of Bali. Calm
              interiors meet intimate outdoor spaces.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="site-section">
        <div className="site-wrap site-grid-2">
          <Reveal className="site-media">
            <img
              src={unsplash(SITE_IMAGES.interiorLounge, { w: 1000 })}
              alt="Living space with sculpted concrete and warm teak finishes"
            />
          </Reveal>
          <Reveal delay={100}>
            <p className="site-eyebrow">Cemagi Atelier</p>
            <h2 className="site-h2">Natural materials. Lasting character.</h2>
            <p className="site-body">
              The design direction brings together sculpted concrete,
              Sukabumi stone and warm teak. Open living spaces create an easy
              rhythm between indoors and out.
            </p>
            <div className="site-spec-list">
              <div className="site-spec-row">
                <span className="label">Architecture</span>
                <span className="value">Two-storey loft living</span>
              </div>
              <div className="site-spec-row">
                <span className="label">Landscape</span>
                <span className="value">Private garden &amp; plunge pool</span>
              </div>
              <div className="site-spec-row">
                <span className="label">Finishes</span>
                <span className="value">Stone, concrete &amp; teak</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="site-section">
        <div className="site-wrap site-grid-2">
          <Reveal delay={100} className="site-grid-2-text">
            <p className="site-eyebrow">02 / Interior &amp; outdoor flow</p>
            <h2 className="site-h2">Rooms that open outward.</h2>
            <p className="site-body">
              Full-height glazing and covered terraces blur the line between
              inside and out. Every residence is laid out so the pool,
              garden and living spaces read as one continuous room.
            </p>
            <div className="site-cta-row">
              <Link href="/villas" className="site-btn site-btn-primary">
                See the villa collection
              </Link>
            </div>
          </Reveal>
          <Reveal className="site-media">
            <img
              src={unsplash(SITE_IMAGES.poolDeckDusk, { w: 1000 })}
              alt="Private plunge pool and covered terrace at dusk"
            />
          </Reveal>
        </div>
      </section>

      <section className="site-section">
        <div className="site-wrap" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {[
            { img: SITE_IMAGES.interiorBedroom, caption: "Bedrooms finished in warm teak and linen" },
            { img: SITE_IMAGES.interiorLiving, caption: "Open living areas with concealed lighting" },
            { img: SITE_IMAGES.poolCloseUp, caption: "Stone-edged plunge pools, built per residence" },
          ].map((item, i) => (
            <Reveal key={item.img} delay={i * 80} className="site-media">
              <img src={unsplash(item.img, { w: 700 })} alt={item.caption} />
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
