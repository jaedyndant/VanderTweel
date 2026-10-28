import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getVillaForOffice } from "@/lib/office-data";
import { createUpdateAction } from "@/lib/office-actions";
import { formatDate } from "@/lib/koper-format";

export const instant = false;

// Updates — pm and developer both read+write. This is the concrete
// team-to-koper link (TO chapter 4): a row inserted here is the same
// `update` table the buyer's /koper/voortgang screen reads.
export default async function VillaUpdatesPage({ params }: { params: Promise<{ code: string }> }) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || (user.role !== "pm" && user.role !== "developer")) notFound();

  const { code } = await params;
  const villaCode = decodeURIComponent(code);
  const detail = await getVillaForOffice(user.id, user.role as "pm" | "developer", villaCode);
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">{detail.villa.code} — Updates</h1>

      <form
        action={createUpdateAction}
        className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
      >
        <input type="hidden" name="villaCode" value={villaCode} />
        <input
          name="title"
          placeholder="Titel"
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        <select name="category" className="w-full rounded border border-neutral-300 px-3 py-2 text-sm">
          <option value="Construction">Construction</option>
          <option value="Payment">Payment</option>
          <option value="Paperwork">Paperwork</option>
        </select>
        <textarea
          name="body"
          placeholder="Bericht aan de koper..."
          required
          rows={3}
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-full bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white">
          Plaatsen — direct zichtbaar bij de koper
        </button>
      </form>

      <ul className="space-y-3">
        {detail.updates.map((u) => (
          <li key={u.id} className="rounded-lg border border-neutral-200 bg-white p-3">
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>
                {u.category ?? "Update"} · {u.authorRoleLabel ?? ""}
              </span>
              <span>{formatDate(u.createdAt)}</span>
            </div>
            {u.title && <p className="mt-1 font-medium">{u.title}</p>}
            <p className="mt-1 text-sm text-neutral-700">{u.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
