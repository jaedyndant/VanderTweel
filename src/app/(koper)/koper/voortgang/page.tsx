import type { Metadata } from "next";
import {
  ClientRoute,
  type ClientSearchParams,
} from "../_components/client-route";

export const instant = false;
export const metadata: Metadata = { title: "Progress" };

export default function KoperProgress({
  searchParams,
}: {
  searchParams: ClientSearchParams;
}) {
  return <ClientRoute page="progress" searchParams={searchParams} />;
}
