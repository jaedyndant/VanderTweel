import { OfficeRoute, type OfficeSearchParams } from "../_components/office-route";

export const instant = false;
export const metadata = { title: "Residences" };

export default function OfficeVillasPage({
  searchParams,
}: {
  searchParams: OfficeSearchParams;
}) {
  return <OfficeRoute page="villas" searchParams={searchParams} />;
}
