import type { Metadata } from "next";
import {
  ClientRoute,
  type ClientSearchParams,
} from "../_components/client-route";

export const instant = false;
export const metadata: Metadata = { title: "Payments" };

export default function KoperPayments({
  searchParams,
}: {
  searchParams: ClientSearchParams;
}) {
  return <ClientRoute page="payments" searchParams={searchParams} />;
}
