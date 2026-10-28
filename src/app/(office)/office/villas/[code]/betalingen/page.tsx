import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getVillaForOffice } from "@/lib/office-data";
import { markPaymentPaidAction } from "@/lib/office-actions";
import { formatUsd, formatDate } from "@/lib/koper-format";

export const instant = false;

// Betalingen — developer-only (TO 1.3: pm screens exclude money entirely).
// Gated twice: here at the page (role check up front) AND again inside
// markPaymentPaidAction server-side, so a forged form submit can't bypass it.
export default async function VillaPaymentsPage({ params }: { params: Promise<{ code: string }> }) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== "developer") notFound();

  const { code } = await params;
  const villaCode = decodeURIComponent(code);
  const detail = await getVillaForOffice(user.id, "developer", villaCode);
  if (!detail || !detail.milestones) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">{detail.villa.code} — Betalingen</h1>
      <ul className="space-y-2">
        {detail.milestones.map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-white p-3"
          >
            <div>
              <p className="font-medium">
                {m.dueLabel} · {m.percent}%
              </p>
              <p className="text-sm text-neutral-600">{formatUsd(m.amountUsd)}</p>
              <p className="text-xs text-neutral-500">
                {m.status === "paid" ? `Betaald ${formatDate(m.paidAt)}` : m.note ?? "Open"}
              </p>
            </div>
            <form
              action={async () => {
                "use server";
                await markPaymentPaidAction(m.id, villaCode);
              }}
            >
              <button
                type="submit"
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                  m.status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-700"
                }`}
              >
                {m.status === "paid" ? "Betaald — zet terug" : "Markeer betaald"}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
