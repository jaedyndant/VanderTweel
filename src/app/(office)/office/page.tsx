import { OfficeRoute, type OfficeSearchParams } from "./_components/office-route";

export const instant = false;
export const metadata = { title: "Development overview" };

export default function OfficeOverviewPage({
  searchParams,
}: {
  searchParams: OfficeSearchParams;
}) {
  return <OfficeRoute page="overview" searchParams={searchParams} />;
}
