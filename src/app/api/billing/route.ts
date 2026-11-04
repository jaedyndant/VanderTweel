import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { assertSameOrigin, apiError } from "@/lib/platform-access";
import { dispatchMailOutbox } from "@/lib/mail-outbox";
import { applyBillingTemplate, BillingError, getBillingDashboard, issueBillingInvoice, recordBillingPayment, reverseBillingPayment, saveBillingIssuer, saveBillingRecipient, saveBillingTemplate } from "@/lib/billing/service";

const scope = { projectId: z.uuid(), villaId: z.uuid() };
const commands = z.discriminatedUnion("action", [
  z.object({ action: z.literal("issuer"), projectId: z.uuid(), value: z.unknown() }),
  z.object({ action: z.literal("recipient"), ...scope, value: z.unknown() }),
  z.object({ action: z.literal("template"), projectId: z.uuid(), value: z.unknown() }),
  z.object({ action: z.literal("apply"), ...scope, startDate: z.string(), replaceUnissued: z.boolean() }),
  z.object({ action: z.literal("issue"), ...scope, milestoneId: z.uuid() }),
  z.object({ action: z.literal("pay"), ...scope, milestoneId: z.uuid(), requestId: z.uuid(), amount: z.string(), reference: z.string(), paidDate: z.string() }),
  z.object({ action: z.literal("reverse"), ...scope, paymentId: z.uuid(), reason: z.string() }),
]);
function failure(error: unknown) {
  if (error instanceof BillingError) return Response.json({ error: error.message }, { status: 400 });
  if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message ?? "Check your form fields." }, { status: 400 });
  return apiError(error);
}
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const projectId = z.uuid().parse(query.get("projectId"));
    const villaId = query.get("villaId") ? z.uuid().parse(query.get("villaId")) : undefined;
    return Response.json(await getBillingDashboard(projectId, villaId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "JSON is required." }, { status: 415 });
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > 24_000) return Response.json({ error: "Request is too large." }, { status: 413 });
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
    const input = commands.parse(raw);
    let result: unknown;
    switch (input.action) {
      case "issuer": result = await saveBillingIssuer(input.projectId, input.value); break;
      case "recipient": result = await saveBillingRecipient(input.projectId, input.villaId, input.value); break;
      case "template": result = await saveBillingTemplate(input.projectId, input.value); break;
      case "apply": result = await applyBillingTemplate(input.projectId, input.villaId, input.startDate, input.replaceUnissued); break;
      case "issue": result = await issueBillingInvoice(input.projectId, input.villaId, input.milestoneId); break;
      case "pay": result = await recordBillingPayment(input.projectId, input.villaId, input.milestoneId, input); break;
      case "reverse": result = await reverseBillingPayment(input.projectId, input.villaId, input.paymentId, input.reason); break;
    }
    revalidatePath("/office", "layout");
    revalidatePath("/koper", "layout");
    after(() => dispatchMailOutbox());
    return Response.json({ ok: true, result: result ?? null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}
