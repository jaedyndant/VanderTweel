import { OfficeRoute, type OfficeSearchParams } from "../_components/office-route";

export const instant = false;
export const metadata = { title: "Your account" };

export default function OfficeAccountPage({
  searchParams,
}: {
  searchParams: OfficeSearchParams;
}) {
  return <OfficeRoute page="account" searchParams={searchParams} />;
}
