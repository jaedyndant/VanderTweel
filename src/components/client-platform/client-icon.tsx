import type { ClientPage } from "./types";

export type ClientIconName =
  | ClientPage
  | "sign-out"
  | "image"
  | "mail"
  | "arrow"
  | "close";

const paths: Record<ClientIconName, string> = {
  home: "m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9",
  villa: "M3 21h18M5 21V7l7-4 7 4v14M9 8h1m4 0h1M9 12h1m4 0h1M10 21v-5h4v5",
  progress: "M21 12a9 9 0 1 1-9-9M12 3v9l6 3M16 3h5v5m0-5-6 6",
  payments: "M3 5h18v14H3zM3 9h18M7 14h3m5 0h2",
  documents: "M14 3H5v18h14V8l-5-5v5h5M8 12h8m-8 4h6",
  updates: "M5 3h14v18H5zM8 7h8m-8 4h8m-8 4h5",
  account: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-2a8 8 0 0 1 16 0v2",
  "sign-out": "M9 4H4v16h5M9 12h11m-4-4 4 4-4 4",
  image: "M3 4h18v16H3zM3 17l6-6 4 4 3-3 5 5M15 8h.01",
  mail: "M3 5h18v14H3zM3 6l9 7 9-7",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  close: "m6 6 12 12M18 6 6 18",
};

export function ClientIcon({
  name,
  className = "",
}: {
  name: ClientIconName;
  className?: string;
}) {
  return (
    <svg
      className={`client-icon ${className}`}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
