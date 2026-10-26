import { Suspense } from "react";
import { auth } from "@/lib/auth";

// MS2 scope only: confirm the right account lands here, with the correct
// role shown. Full back-office screens (TO 1.3: 9 developer, 3 pm) are MS4.
export default function OfficeHome() {
  return (
    <main style={{ padding: 32, fontFamily: "system-ui" }}>
      <h1>Back-office</h1>
      <Suspense fallback={<p>Laden...</p>}>
        <SessionInfo />
      </Suspense>
    </main>
  );
}

async function SessionInfo() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  return (
    <>
      <p>Ingelogd als: {session?.user?.email} ({role})</p>
      <p>MS2 landing confirmed — back-office basisschermen volgen in MS4.</p>
    </>
  );
}
