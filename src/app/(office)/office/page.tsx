import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getProjectsOverview } from "@/lib/office-data";

export const instant = false;

// "Projecten" dashboard — MS4 screen 1. Developer: every project (TO 1.3).
// PM: only projects they're linked to via pm_project, resolved entirely at
// the query layer in getProjectsOverview, never filtered client-side.
export default async function OfficeDashboard() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || (user.role !== "pm" && user.role !== "developer")) notFound();

  const role = user.role as "pm" | "developer";
  const projects = await getProjectsOverview(user.id, role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Projecten</h1>
        <p className="text-neutral-600">
          {role === "developer" ? "Alle lopende projecten." : "Jouw toegewezen projecten."}
        </p>
      </div>

      {projects.length === 0 ? (
        <p className="text-sm text-neutral-600">Geen projecten gekoppeld aan dit account.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/office/projecten/${p.slug}`}
                className="block rounded-xl border border-neutral-200 bg-white p-4 shadow-sm hover:border-neutral-300"
              >
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-neutral-500">
                  {p.villaCount} villa{p.villaCount === 1 ? "" : "'s"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
