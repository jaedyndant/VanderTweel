import type { Metadata } from "next";
import {
  ClientRoute,
  type ClientSearchParams,
} from "./_components/client-route";

export const instant = false;
export const metadata: Metadata = { title: "Overview" };

export default function KoperHome({
  searchParams,
}: {
  searchParams: ClientSearchParams;
}) {
  return <ClientRoute page="home" searchParams={searchParams} />;
}
