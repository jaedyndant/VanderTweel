import { OfficeRoute, type OfficeSearchParams } from "../../_components/office-route";

export const instant = false;
export const metadata = { title: "Residence overview" };

export default async function OfficeVillaPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: OfficeSearchParams;
}) {
  const { code } = await params;

  return (
    <OfficeRoute
      page="villa"
      villaCode={code}
      searchParams={searchParams}
    />
  );
}
