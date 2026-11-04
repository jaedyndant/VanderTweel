import Link from "next/link";
import type { Metadata } from "next";
import Reveal from "@/components/site/reveal";
import VillaCard from "@/components/site/villa-card";
import { SITE_IMAGES, unsplash } from "@/components/site/images";
import { getPublicVillas } from "@/lib/public-site-data";

export const metadata: Metadata = {
  title: "The villa collection",
  description: "The Cemagi Atelier villa collection — currently in build.",
};

export default async function VillasPage() {
  const villas = await getPublicVillas();
  const villaImages = [SITE_IMAGES.poolVillaWide, SITE_IMAGES.tropicalHouse];

  return (
    <>
      <section className="site-hero">
        <div className="site-wrap">
          <Reveal as="header">
            <p className="site-eyebrow">
              Cemagi, Bali <span className="muted">/ A collection of two</span>
            </p>
            <h1 className="site-h1">The villa collection.</h1>
            <p className="site-lede">
              Two residences currently under construction at Cemagi Atelier,
              each tracked from first foundation to handover.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="site-section">
        <div className="site-wrap">
          <Reveal className="site-villa-grid">
            {villas.map((villa, i) => (
              <VillaCard key={villa.id} villa={villa} image={villaImages[i % villaImages.length]} />
            ))}
          </Reveal>
        </div>
      </section>

      <section className="site-section">
        <div className="site-wrap site-grid-2">
          <Reveal className="site-media">
            <img
              src={unsplash(SITE_IMAGES.resortPool, { w: 1000 })}
              alt="Shared landscaped pool deck at Cemagi Atelier"
            />
          </Reveal>
          <Reveal delay={100}>
            <p className="site-eyebrow">Shared grounds</p>
            <h2 className="site-h2">A small collection, set in a shared garden.</h2>
            <p className="site-body">
              Both residences share planted grounds and a quiet, low-density
              street — part of what keeps Cemagi Atelier feeling more like a
              neighborhood than a development.
            </p>
            <div className="site-cta-row">
              <Link href="/contact" className="site-btn site-btn-outline">
                Arrange a viewing ↗
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
