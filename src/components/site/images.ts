// Real, non-stock-people Unsplash architecture/villa photography, matching
// modern tropical Bali design (no client photography exists yet — see
// README note in src/app/(site)). Each const name documents what it shows.
export const SITE_IMAGES = {
  heroVilla: "https://images.unsplash.com/photo-1540541338287-41700207dee6",
  poolDeckDusk: "https://images.unsplash.com/photo-1566073771259-6a8506099945",
  poolCloseUp: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750",
  resortPool: "https://images.unsplash.com/photo-1571896349842-33c89424de2d",
  poolVillaWide: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914",
  tropicalHouse: "https://images.unsplash.com/photo-1582610116397-edb318620f90",
  interiorLounge: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9",
  interiorLiving: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c",
  interiorBedroom: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c",
  houseExterior: "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde",
  poolResort: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00",
  poolDeckChairs: "https://images.unsplash.com/photo-1521783988139-89397d761dce",
} as const;

export function unsplash(url: string, opts: { w: number; q?: number }): string {
  const params = new URLSearchParams({
    auto: "format",
    fit: "crop",
    w: String(opts.w),
    q: String(opts.q ?? 80),
  });
  return `${url}?${params.toString()}`;
}
