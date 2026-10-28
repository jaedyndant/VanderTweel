import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPaymentSchedule } from "@/lib/koper-data";
import { formatDate, formatPercent, formatUsd } from "@/lib/koper-format";

// Per-request, session-scoped data — never prerender/cache this route
// statically (Next 16 Cache Components would otherwise try to and fail).
export const instant = false;

// "Betaalschema" — MS3 scherm 3/3 (PvA 4.2). Same server-side authorization
// checkpoint: getPaymentSchedule scopes everything by the session's account
// id, a cross-buyer ?villa= id 404s instead of leaking another buyer's
// payment/document data.
export default async function BetaalschemaPage({
  searchParams,
}: {
  searchParams: Promise<{ villa?: string }>;
}) {
  const session = await auth();
  const accountId = (session?.user as { id?: string } | undefined)?.id;
  if (!accountId) notFound();

  const { villa: requestedVillaId } = await searchParams;
  const data = await getPaymentSchedule(accountId, requestedVillaId);

  if (!data) {
    if (requestedVillaId) notFound();
    return <p className="text-sm text-neutral-600">Nog geen betaalschema beschikbaar.</p>;
  }

  const { villa, milestones, documents } = data;
  const paid = milestones.filter((m) => m.status === "paid");
  const paidTotal = paid.reduce((sum, m) => sum + Number(m.amountUsd ?? 0), 0);
  const contractTotal = Number(villa.priceTotalUsd ?? 0);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-neutral-500">{villa.code}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Betaalschema</h1>
        <p className="mt-2 text-sm text-neutral-600">
          {formatUsd(paidTotal)} betaald van {formatUsd(contractTotal)} ({paid.length}/{milestones.length} termijnen)
        </p>
      </div>

      <section className="space-y-2">
        <ol className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white shadow-sm">
          {milestones.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="font-medium">{m.dueLabel}</p>
                <p className="text-xs text-neutral-500">{formatPercent(m.percent)} van de contractwaarde</p>
                {m.note && <p className="mt-1 text-sm text-neutral-600">{m.note}</p>}
                <p className="mt-1 text-xs text-neutral-500">
                  {m.status === "paid" ? `Betaald — ${formatDate(m.paidAt)}` : `Verwacht — ${formatDate(m.expectedAt)}`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold">{formatUsd(m.amountUsd)}</p>
                <StatusPill status={m.status} />
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Documenten</h2>
        {documents.length === 0 && <p className="text-sm text-neutral-600">Nog geen documenten.</p>}
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li key={doc.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <a href={doc.url} className="font-medium underline" target="_blank" rel="noreferrer">
                {doc.label ?? doc.url}
              </a>
              {doc.note && <p className="mt-1 text-sm text-neutral-600">{doc.note}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const isPaid = status === "paid";
  return (
    <span
      className={`mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isPaid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
      }`}
    >
      {isPaid ? "Betaald" : "Open"}
    </span>
  );
}
