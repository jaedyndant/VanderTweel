import Link from "next/link";
import { unsplash } from "./images";
import type { PublicVilla } from "@/lib/public-site-data";

function formatHandover(iso: string | null): string {
  if (!iso) return "Handover TBC";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export default function VillaCard({
  villa,
  image,
}: {
  villa: PublicVilla;
  image: string;
}) {
  return (
    <Link href={`/villas/${villa.slug}`} className="site-villa-card">
      <div className="site-villa-card-media">
        <img
          src={unsplash(image, { w: 900 })}
          alt={`${villa.code} — ${villa.typeLabel ?? "villa"} exterior`}
          loading="lazy"
        />
      </div>
      <div className="site-villa-card-body">
        <h3 className="serif">{villa.code}</h3>
        <div className="type">
          {villa.typeLabel} &middot; {villa.plotM2}m&sup2; plot
        </div>
        <div className="site-body" style={{ fontSize: 14 }}>
          Handover {formatHandover(villa.handoverExpected)}
        </div>
        <div className="price">
          {villa.priceTotalUsd
            ? `$${villa.priceTotalUsd.toLocaleString("en-US")} USD`
            : "Price on request"}
        </div>
      </div>
    </Link>
  );
}
