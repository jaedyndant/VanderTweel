import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getBuyersDirectory } from "@/lib/office-data";

export const instant = false;

// Kopers — MS4 developer-only screen (TO 1.3). getBuyersDirectory returns
// null for a pm role rather than filtering an array, so there is no code
// path where a pm account can ever receive buyer data from this function.
export default async function BuyersDirectoryPage() {
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;
  if (!user?.role || user.role !== "developer") notFound();

  const buyers = await getBuyersDirectory("developer");
  if (!buyers) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kopers</h1>
        <p className="text-neutral-600">Alle kopers over alle projecten heen.</p>
      </div>

      {buyers.length === 0 ? (
        <p className="text-sm text-neutral-600">Nog geen kopers.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {buyers.map((b) => (
            <li key={b.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <p className="font-medium">{b.name}</p>
              <p className="text-sm text-neutral-500">{b.country}</p>
              {b.villas.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {b.villas.map((v) => (
                    <li key={v.id}>
                      <Link href={`/office/villas/${encodeURIComponent(v.code)}`} className="text-neutral-700 hover:underline">
                        {v.code}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
