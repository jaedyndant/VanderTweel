import { OfficeRoute, type OfficeSearchParams } from "../_components/office-route";

export const instant = false;
export const metadata = { title: "Payments" };

export default function OfficePaymentsPage({
  searchParams,
}: {
  searchParams: OfficeSearchParams;
}) {
  return <OfficeRoute page="payments" searchParams={searchParams} />;
}
