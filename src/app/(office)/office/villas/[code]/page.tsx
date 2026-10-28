import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getVillaForOffice } from "@/lib/office-data";
import { formatM2, formatUsd, formatDate, totalProgressPercent } from "@/lib/koper-format";

export const instant = false;

// Villa hub — MS4 screen 3. TO 1.3: a pm never gets milestones/files back
// from getVillaForOffice at all (both are `null`, not fetched-then-hidden),
// so the "Betalingen"/"Bestanden" links below only render for a developer.
export default async function VillaHubPage({ params }: { params: Promise<{ code: string }> }) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || (user.role !== "pm" && user.role !== "developer")) notFound();

  const { code } = await params;
  const villaCode = decodeURIComponent(code);
  const role = user.role as "pm" | "developer";
  const detail = await getVillaForOffice(user.id, role, villaCode);
  if (!detail) notFound();

  const { villa, project, buyerName, tasks, milestones } = detail;
  const progressPct = totalProgressPercent(tasks);

  return (
    <div className="space-y-6">
      <div>
        {project && (
          <Link href={`/office/projecten/${project.slug}`} className="text-sm text-neutral-500 hover:underline">
            ← {project.name}
          </Link>
        )}
        <p className="mt-1 text-sm text-neutral-500">{buyerName ?? "Nog geen koper gekoppeld"}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{villa.code}</h1>
        <p className="text-neutral-600">
          {villa.typeLabel ?? "Loftvilla"} · {progressPct}% voortgang
        </p>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <Fact label="Kavel" value={formatM2(villa.plotM2)} />
          <Fact label="Bebouwd" value={formatM2(villa.builtM2)} />
          <Fact label="Status" value={villa.status.replace(/_/g, " ")} />
          <Fact label="Bouw gestart" value={formatDate(villa.buildStarted)} />
          <Fact label="Verwachte oplevering" value={formatDate(villa.handoverExpected)} />
          {milestones && <Fact label="Contractwaarde" value={formatUsd(villa.priceTotalUsd)} />}
        </dl>
      </section>

      <nav className="flex flex-wrap gap-2 text-sm">
        <PillLink href={`/office/villas/${encodeURIComponent(villa.code)}/voortgang`}>Voortgang</PillLink>
        <PillLink href={`/office/villas/${encodeURIComponent(villa.code)}/updates`}>Updates</PillLink>
        {milestones && (
          <PillLink href={`/office/villas/${encodeURIComponent(villa.code)}/betalingen`}>Betalingen</PillLink>
        )}
        {detail.files && (
          <PillLink href={`/office/villas/${encodeURIComponent(villa.code)}/bestanden`}>Bestanden</PillLink>
        )}
      </nav>
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

function PillLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-neutral-200 bg-white px-4 py-1.5 font-medium text-neutral-700 hover:border-neutral-300"
    >
      {children}
    </Link>
  );
}
