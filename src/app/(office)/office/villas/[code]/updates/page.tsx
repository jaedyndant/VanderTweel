import { OfficeRoute, type OfficeSearchParams } from "../../../_components/office-route";

export const instant = false;
export const metadata = { title: "Residence updates" };

export default async function OfficeVillaUpdatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: OfficeSearchParams;
}) {
  const { code } = await params;

  return (
    <OfficeRoute
      page="updates"
      villaCode={code}
      searchParams={searchParams}
    />
  );
}
