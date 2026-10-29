"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// MS5: near-realtime sync via polling (TO 3.1 -- the PvA explicitly chooses
// polling over websockets/SSE for this project). router.refresh() re-runs
// the current route's server components, so a koper sees a team update,
// payment, or progress change without ever touching the page themselves.
// 20s keeps "within 1 minute" (MS5 klaar-criterium) comfortably inside budget.
export default function PollRefresh({ intervalMs = 20_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
