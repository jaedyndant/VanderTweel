import { requireActor } from "@/lib/platform-access";
import { getManagementData } from "@/lib/management/service";
import { managementErrorResponse } from "@/lib/management/http";


export async function GET() {
  try {
    const actor = await requireActor(true);
    return Response.json({ ok: true, data: await getManagementData(actor) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return managementErrorResponse(error); }
}
