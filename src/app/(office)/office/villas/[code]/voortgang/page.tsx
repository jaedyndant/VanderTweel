import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getVillaForOffice } from "@/lib/office-data";
import { toggleProgressTaskAction } from "@/lib/office-actions";
import { formatDate } from "@/lib/koper-format";

export const instant = false;

// Voortgang — pm and developer both read+write (TO 1.3: build phases are
// not money/contract data, so this screen isn't developer-only).
export default async function VillaProgressPage({ params }: { params: Promise<{ code: string }> }) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || (user.role !== "pm" && user.role !== "developer")) notFound();

  const { code } = await params;
  const villaCode = decodeURIComponent(code);
  const detail = await getVillaForOffice(user.id, user.role as "pm" | "developer", villaCode);
  if (!detail) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">{detail.villa.code} — Voortgang</h1>
      <ul className="space-y-2">
        {detail.tasks.map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-white p-3"
          >
            <div>
              <p className="font-medium">{t.phase}</p>
              {t.detail && <p className="text-sm text-neutral-600">{t.detail}</p>}
              <p className="text-xs text-neutral-500">
                {t.period ? `${t.period} · ` : ""}
                {t.doneAt ? `Afgerond ${formatDate(t.doneAt)}` : "Nog niet afgerond"}
              </p>
            </div>
            <form
              action={async () => {
                "use server";
                await toggleProgressTaskAction(t.id, villaCode);
              }}
            >
              <button
                type="submit"
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                  t.doneAt ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-700"
                }`}
              >
                {t.doneAt ? "Afgerond — zet terug" : "Markeer afgerond"}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
