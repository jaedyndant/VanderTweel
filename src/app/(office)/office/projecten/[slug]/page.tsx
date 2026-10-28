import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getProjectDetail } from "@/lib/office-data";
import { formatM2 } from "@/lib/koper-format";

export const instant = false;

// Project detail — MS4 screen 2. Villa list with buyer name + status.
// Authorization (pm must own this project) happens inside getProjectDetail,
// which returns null for an unauthorized project id — never a 403 page
// leaking the project's existence, just a plain 404 (TO 9.1).
export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || (user.role !== "pm" && user.role !== "developer")) notFound();

  const { slug } = await params;
  const role = user.role as "pm" | "developer";
  const detail = await getProjectDetail(user.id, role, slug);
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/office" className="text-sm text-neutral-500 hover:underline">
          ← Projecten
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{detail.project.name}</h1>
      </div>

      {detail.villas.length === 0 ? (
        <p className="text-sm text-neutral-600">Nog geen villa&apos;s in dit project.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {detail.villas.map((v) => (
            <li key={v.id}>
              <Link
                href={`/office/villas/${encodeURIComponent(v.code)}`}
                className="block rounded-xl border border-neutral-200 bg-white p-4 shadow-sm hover:border-neutral-300"
              >
                <p className="font-medium">{v.code}</p>
                <p className="text-sm text-neutral-500">{v.buyerName ?? "Nog geen koper gekoppeld"}</p>
                <p className="mt-2 text-xs uppercase tracking-wide text-neutral-500">
                  {v.status.replace(/_/g, " ")}
                </p>
                <p className="text-sm text-neutral-600">{formatM2(v.builtM2)} bebouwd</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
