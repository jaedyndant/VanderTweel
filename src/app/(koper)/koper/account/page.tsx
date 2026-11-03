import type { Metadata } from "next";
import {
  ClientRoute,
  type ClientSearchParams,
} from "../_components/client-route";

export const instant = false;
export const metadata: Metadata = { title: "Account" };

export default function KoperAccount({
  searchParams,
}: {
  searchParams: ClientSearchParams;
}) {
  return <ClientRoute page="account" searchParams={searchParams} />;
}
