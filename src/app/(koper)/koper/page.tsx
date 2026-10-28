import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getVillaOverview } from "@/lib/koper-data";
import { formatM2, formatUsd, formatDate } from "@/lib/koper-format";

// Per-request, session-scoped data — never prerender/cache this route
// statically (Next 16 Cache Components would otherwise try to and fail,
// since auth()/searchParams are read at request time).
export const instant = false;

// "Eigen villa" — MS3 scherm 1/3 (PvA 4.2). Server-side scoped by the
// session's account id via getVillaOverview -> getAuthorizedVilla; a
// requested ?villa= id that isn't this buyer's own villa gets a 404, never
// someone else's data (MS3 klaar-criterium).
export default async function KoperHome({
  searchParams,
}: {
  searchParams: Promise<{ villa?: string }>;
}) {
  const session = await auth();
  const accountId = (session?.user as { id?: string } | undefined)?.id;
  if (!accountId) notFound();

  const { villa: requestedVillaId } = await searchParams;
  const overview = await getVillaOverview(accountId, requestedVillaId);

  if (!overview) {
    // Either this account has no villa linked at all, or the requested id
    // belongs to another buyer — in both cases we show nothing, never fall
    // back to someone else's villa.
    if (requestedVillaId) notFound();
    return (
      <p className="text-sm text-neutral-600">
        Er is nog geen villa aan jouw account gekoppeld. Neem contact op met het Cemagi Atelier-team.
      </p>
    );
  }

  const { villa, buyerName } = overview;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-neutral-500">Welkom{buyerName ? `, ${buyerName}` : ""}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{villa.code}</h1>
        <p className="text-neutral-600">{villa.typeLabel ?? "Loftvilla"}</p>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <StatusBadge status={villa.status} />
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <Fact label="Kavel" value={formatM2(villa.plotM2)} />
          <Fact label="Bebouwd" value={formatM2(villa.builtM2)} />
          <Fact label="Buitenruimte" value={formatM2(villa.outdoorM2)} />
          <Fact label="Lease" value={villa.leaseYears ? `${villa.leaseYears} jaar` : "—"} />
          <Fact label="Pakket" value={villa.pricePackage ?? "—"} />
          <Fact label="Contractwaarde" value={formatUsd(villa.priceTotalUsd)} />
          <Fact label="Bouw gestart" value={formatDate(villa.buildStarted)} />
          <Fact label="Verwachte oplevering" value={formatDate(villa.handoverExpected)} />
        </dl>
      </section>

      <p className="text-sm text-neutral-500">
        Zie{" "}
        <a className="underline" href="/koper/voortgang">
          Voortgang
        </a>{" "}
        voor de bouwfases en{" "}
        <a className="underline" href="/koper/betaalschema">
          Betaalschema
        </a>{" "}
        voor je betalingen en documenten.
      </p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, " ");
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium capitalize text-emerald-800">
      {label}
    </span>
  );
}
