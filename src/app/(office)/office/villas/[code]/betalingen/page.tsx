import { OfficeRoute, type OfficeSearchParams } from "../../../_components/office-route";

export const instant = false;
export const metadata = { title: "Residence payments" };

export default async function OfficeVillaPaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: OfficeSearchParams;
}) {
  const { code } = await params;

  return (
    <OfficeRoute
      page="payments"
      villaCode={code}
      searchParams={searchParams}
    />
  );
}
