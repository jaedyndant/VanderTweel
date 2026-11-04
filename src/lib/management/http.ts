import { assertSameOrigin, requireActor } from "@/lib/platform-access";
import { after } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { dispatchMailOutbox } from "@/lib/mail-outbox";
import { checkRateLimit } from "@/lib/rate-limit";
import { ManagementError } from "./validation";

export function managementErrorResponse(error: unknown) {
  unstable_rethrow(error);
  if (error instanceof ManagementError) return Response.json({ ok: false, error: error.message }, { status: error.status });
  // Shared authorization errors are deliberately reduced to a fixed message.
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
  if (status === 401 || status === 403) return Response.json({ ok: false, error: "Developer access is required. Sign in and try again." }, { status });
  return Response.json({ ok: false, error: "The save could not be confirmed. Refresh the list before trying again." }, { status: 500 });
}

export function assertManagementOrigin(request: Request) {
  assertSameOrigin(request);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new ManagementError("Send a JSON form.", 415);
}

export async function managementMutation(request: Request, operation: (actor: { id: string; role: string }, body: unknown) => Promise<unknown>, mail = false) {
  try {
    assertManagementOrigin(request);
    const actor = await requireActor(true);
    if (!await checkRateLimit(`management:${mail ? "mail" : "write"}:${actor.id}`, mail ? 25 : 120, 3600)) {
      throw new ManagementError("Too many management requests. Please wait before trying again.", 429);
    }
    if (Number(request.headers.get("content-length")) > 65536) throw new ManagementError("The form is too large.", 413);
    const raw = await request.text();
    if (raw.length > 65536) throw new ManagementError("The form is too large.", 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { throw new ManagementError("The submitted form is invalid."); }
    const result = await operation(actor, body);
    if (mail) after(() => dispatchMailOutbox());
    return Response.json({ ok: true, result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return managementErrorResponse(error); }
}
