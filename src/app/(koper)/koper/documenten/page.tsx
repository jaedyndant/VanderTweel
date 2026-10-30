import type { Metadata } from "next";
import {
  ClientRoute,
  type ClientSearchParams,
} from "../_components/client-route";

export const instant = false;
export const metadata: Metadata = { title: "Documents" };

export default function KoperDocuments({
  searchParams,
}: {
  searchParams: ClientSearchParams;
}) {
  return <ClientRoute page="documents" searchParams={searchParams} />;
}
