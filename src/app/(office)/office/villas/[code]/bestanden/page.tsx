import { OfficeRoute, type OfficeSearchParams } from "../../../_components/office-route";

export const instant = false;
export const metadata = { title: "Residence documents" };

export default async function OfficeVillaDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: OfficeSearchParams;
}) {
  const { code } = await params;

  return (
    <OfficeRoute
      page="documents"
      villaCode={code}
      searchParams={searchParams}
    />
  );
}
