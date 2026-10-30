import { OfficeRoute, type OfficeSearchParams } from "../../_components/office-route";

export const instant = false;
export const metadata = { title: "Project overview" };

export default async function OfficeProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: OfficeSearchParams;
}) {
  const { slug } = await params;

  return (
    <OfficeRoute
      page="project"
      projectSlug={slug}
      searchParams={searchParams}
    />
  );
}
