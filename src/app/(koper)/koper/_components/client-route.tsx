import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getClientPlatformData } from "@/lib/client-platform-data";
import { ClientPlatform } from "@/components/client-platform/client-platform";
import type { ClientPage } from "@/components/client-platform/types";

export type ClientSearchParams = Promise<{ villa?: string | string[] }>;

/** Every buyer route repeats the session and object-level authorization. */
export async function ClientRoute({
  page,
  searchParams,
}: {
  page: ClientPage;
  searchParams: ClientSearchParams;
}) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== "buyer") redirect("/login");

  const { villa: requestedVillaId } = await searchParams;
  if (Array.isArray(requestedVillaId)) notFound();
  const data = await getClientPlatformData(user.id, requestedVillaId, page);

  if (!data) {
    if (requestedVillaId) notFound();
    return (
      <main className="client-route-state">
        <section aria-labelledby="client-empty-title">
          <p className="client-state-eyebrow">Van der Tweel · Owner platform</p>
          <h1 id="client-empty-title">Your residence is being prepared.</h1>
          <p>
            No residence has been linked to your account yet. Please contact the
            Van der Tweel team using your existing contact details so they can
            connect your residence.
          </p>
          <Link href="/login">
            Back to sign in <span aria-hidden="true"> ↗</span>
          </Link>
        </section>
      </main>
    );
  }

  return <ClientPlatform data={data} page={page} />;
}
