import type { Metadata } from "next";
import {
  ClientRoute,
  type ClientSearchParams,
} from "../_components/client-route";

export const instant = false;
export const metadata: Metadata = { title: "Updates" };

export default function KoperUpdates({
  searchParams,
}: {
  searchParams: ClientSearchParams;
}) {
  return <ClientRoute page="updates" searchParams={searchParams} />;
}
