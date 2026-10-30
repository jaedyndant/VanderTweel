import { OfficeRoute, type OfficeSearchParams } from "../../../_components/office-route";

export const instant = false;
export const metadata = { title: "Construction progress" };

export default async function OfficeVillaProgressPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: OfficeSearchParams;
}) {
  const { code } = await params;

  return (
    <OfficeRoute
      page="progress"
      villaCode={code}
      searchParams={searchParams}
    />
  );
}
