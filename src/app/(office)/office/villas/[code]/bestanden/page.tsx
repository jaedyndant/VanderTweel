import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getVillaForOffice } from "@/lib/office-data";
import { addFileAction } from "@/lib/office-actions";
import { formatDate } from "@/lib/koper-format";

export const instant = false;

// Bestanden — developer-only (TO 1.3: pm screens exclude contract files
// entirely; TO ch.6: we only ever store a url, never raw bytes, in the db).
export default async function VillaFilesPage({ params }: { params: Promise<{ code: string }> }) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== "developer") notFound();

  const { code } = await params;
  const villaCode = decodeURIComponent(code);
  const detail = await getVillaForOffice(user.id, "developer", villaCode);
  if (!detail || !detail.files) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">{detail.villa.code} — Bestanden</h1>

      <form
        action={addFileAction}
        className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
      >
        <input type="hidden" name="villaCode" value={villaCode} />
        <input
          name="label"
          placeholder="Naam bestand"
          required
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          name="url"
          placeholder="https://..."
          required
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          name="note"
          placeholder="Notitie (optioneel)"
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-full bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white">
          Toevoegen
        </button>
      </form>

      <ul className="space-y-2">
        {detail.files.map((f) => (
          <li key={f.id} className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-3">
            <div>
              <a href={f.url} target="_blank" rel="noreferrer" className="font-medium text-neutral-900 hover:underline">
                {f.label ?? f.url}
              </a>
              {f.note && <p className="text-sm text-neutral-600">{f.note}</p>}
            </div>
            <span className="text-xs text-neutral-500">{formatDate(f.createdAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
