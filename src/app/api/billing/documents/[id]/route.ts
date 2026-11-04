import { z } from "zod";
import { apiError } from "@/lib/platform-access";
import { getAuthorizedBillingDocument } from "@/lib/billing/service";
import { renderBillingPdf } from "@/lib/billing/pdf";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const parsed = z.uuid().safeParse((await context.params).id);
    if (!parsed.success) return Response.json({ error: "Document not found." }, { status: 404 });
    const row = await getAuthorizedBillingDocument(parsed.data);
    if (!row) return Response.json({ error: "Document not found." }, { status: 404 });
    const bytes = await renderBillingPdf(row.document.snapshot, row.reversedAt ? { at: row.reversedAt, reason: row.reversalReason } : undefined);
    return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${row.document.number.replace(/[^A-Z0-9_-]/gi, "-")}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return apiError(error); }
}
