import { Suspense } from "react";
import { auth } from "@/lib/auth";

// MS2 scope only: confirm the right account lands here. Full koper-app
// screens (eigen villa, voortgang, betaalschema, 3D, foto's, updates,
// documenten, account — TO 1.2) are MS3.
export default function KoperHome() {
  return (
    <main style={{ padding: 32, fontFamily: "system-ui" }}>
      <h1>Koper-app</h1>
      <Suspense fallback={<p>Laden...</p>}>
        <SessionInfo />
      </Suspense>
    </main>
  );
}

async function SessionInfo() {
  const session = await auth();
  return (
    <>
      <p>Ingelogd als: {session?.user?.email}</p>
      <p>MS2 landing confirmed — koper-app basisschermen volgen in MS3.</p>
    </>
  );
}
