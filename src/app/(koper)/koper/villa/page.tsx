import type { Metadata } from "next";
import {
  ClientRoute,
  type ClientSearchParams,
} from "../_components/client-route";

export const instant = false;
export const metadata: Metadata = { title: "Your villa" };

export default function KoperVilla({
  searchParams,
}: {
  searchParams: ClientSearchParams;
}) {
  return <ClientRoute page="villa" searchParams={searchParams} />;
}
