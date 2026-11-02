import { OfficeRoute, type OfficeSearchParams } from "../_components/office-route";

export const instant = false;
export const metadata = { title: "Documents" };

export default function OfficeDocumentsPage({
  searchParams,
}: {
  searchParams: OfficeSearchParams;
}) {
  return <OfficeRoute page="documents" searchParams={searchParams} />;
}
