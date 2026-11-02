import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { clientSans, clientSerif } from "../(koper)/fonts";
import "./office-route-state.css";

// Session and scoped office data are always resolved for the current request.
export const instant = false;

export const metadata: Metadata = {
  title: {
    default: "Development office · Van der Tweel",
    template: "%s · Van der Tweel",
  },
  description:
    "Your private development workspace for residences, construction and owner records.",
  robots: { index: false, follow: false },
};

export default async function OfficeLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || (user.role !== "pm" && user.role !== "developer")) {
    redirect("/login");
  }

  return (
    <div
      className={`${clientSans.variable} ${clientSerif.variable} office-route-root`}
      lang="en"
    >
      {children}
    </div>
  );
}
