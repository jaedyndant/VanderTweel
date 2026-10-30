import localFont from "next/font/local";

// The exact typefaces and weights used by the approved client demo.
// Self-hosted so the buyer portal makes no requests to Google Fonts.
export const clientSans = localFont({
  src: [
    { path: "./fonts/dm-sans-400-normal.ttf", weight: "400", style: "normal" },
    { path: "./fonts/dm-sans-500-normal.ttf", weight: "500", style: "normal" },
    { path: "./fonts/dm-sans-600-normal.ttf", weight: "600", style: "normal" },
    { path: "./fonts/dm-sans-700-normal.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-client-sans",
  display: "swap",
});

export const clientSerif = localFont({
  src: [
    {
      path: "./fonts/newsreader-400-normal.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/newsreader-500-normal.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/newsreader-400-italic.ttf",
      weight: "400",
      style: "italic",
    },
  ],
  variable: "--font-client-serif",
  display: "swap",
});
