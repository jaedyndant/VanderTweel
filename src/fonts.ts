import localFont from "next/font/local";

// Shared copy of the (koper) app's localFont setup so the public marketing
// site ((site)) can use the exact same approved typefaces without importing
// across route-group boundaries. Points at the same physical .ttf files
// under (koper)/fonts — do not duplicate the font files themselves, and do
// not touch (koper)/fonts.ts (off-limits per the public-site build scope).
export const clientSans = localFont({
  src: [
    {
      path: "./app/(koper)/fonts/dm-sans-400-normal.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./app/(koper)/fonts/dm-sans-500-normal.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "./app/(koper)/fonts/dm-sans-600-normal.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "./app/(koper)/fonts/dm-sans-700-normal.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-client-sans",
  display: "swap",
});

export const clientSerif = localFont({
  src: [
    {
      path: "./app/(koper)/fonts/newsreader-400-normal.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./app/(koper)/fonts/newsreader-500-normal.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "./app/(koper)/fonts/newsreader-400-italic.ttf",
      weight: "400",
      style: "italic",
    },
  ],
  variable: "--font-client-serif",
  display: "swap",
});
