import { OfficeRoute, type OfficeSearchParams } from "../_components/office-route";

export const instant = false;
export const metadata = { title: "Site updates" };

export default function OfficeUpdatesPage({
  searchParams,
}: {
  searchParams: OfficeSearchParams;
}) {
  return <OfficeRoute page="updates" searchParams={searchParams} />;
}
