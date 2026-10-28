import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getVillaProgress } from "@/lib/koper-data";
import { formatDate, totalProgressPercent } from "@/lib/koper-format";

// Per-request, session-scoped data — never prerender/cache this route
// statically (Next 16 Cache Components would otherwise try to and fail).
export const instant = false;

// "Voortgang" — MS3 scherm 2/3 (PvA 4.2). Same server-side authorization
// checkpoint as the other koper screens: getVillaProgress scopes everything
// by the session's account id, a cross-buyer ?villa= id 404s instead of
// leaking another buyer's build phases/updates.
export default async function VoortgangPage({
  searchParams,
}: {
  searchParams: Promise<{ villa?: string }>;
}) {
  const session = await auth();
  const accountId = (session?.user as { id?: string } | undefined)?.id;
  if (!accountId) notFound();

  const { villa: requestedVillaId } = await searchParams;
  const data = await getVillaProgress(accountId, requestedVillaId);

  if (!data) {
    if (requestedVillaId) notFound();
    return <p className="text-sm text-neutral-600">Nog geen voortgang beschikbaar.</p>;
  }

  const { villa, tasks, updates } = data;
  const donePercent = totalProgressPercent(tasks);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-neutral-500">{villa.code}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Voortgang</h1>
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${Math.min(donePercent, 100)}%` }}
            />
          </div>
          <p className="mt-1 text-sm text-neutral-600">{donePercent}% voltooid</p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Bouwfases</h2>
        <ol className="space-y-2">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <span
                aria-hidden
                className={`mt-0.5 h-3 w-3 shrink-0 rounded-full ${
                  task.doneAt ? "bg-emerald-500" : "bg-neutral-300"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{task.phase}</p>
                  <span className="text-xs text-neutral-500">{task.period}</span>
                </div>
                {task.detail && <p className="mt-0.5 text-sm text-neutral-600">{task.detail}</p>}
                <p className="mt-1 text-xs text-neutral-500">
                  {task.doneAt ? `Afgerond — ${formatDate(task.doneAt)}` : "Nog niet gestart/in uitvoering"}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Updates van het team</h2>
        {updates.length === 0 && <p className="text-sm text-neutral-600">Nog geen updates.</p>}
        <ul className="space-y-3">
          {updates.map((u) => (
            <li key={u.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">{u.title}</p>
                <span className="text-xs text-neutral-500">{formatDate(u.createdAt)}</span>
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                {u.authorRoleLabel} · {u.category}
              </p>
              <p className="mt-2 text-sm text-neutral-700">{u.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
