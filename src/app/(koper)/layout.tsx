import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import PollRefresh from "@/components/poll-refresh";
import { clientSans, clientSerif } from "./fonts";
import "./client-route-state.css";

// Per-request session check — never prerender/cache this layout statically.
export const instant = false;

export const metadata: Metadata = {
  title: {
    default: "Your residence · Van der Tweel",
    template: "%s · Van der Tweel",
  },
  description:
    "Your private residence, construction progress, payment records and project documents.",
  robots: { index: false, follow: false },
};

export default async function KoperLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== "buyer") redirect("/login");

  return (
    <div
      className={`${clientSans.variable} ${clientSerif.variable} client-route-root`}
      lang="en"
    >
      {/* MS5: preserve the existing 20-second refresh of server-scoped data. */}
      <PollRefresh />
      {children}
    </div>
  );
}
