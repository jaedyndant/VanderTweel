import { finalizeUpload } from "@/lib/files/service";
import { assertSameOrigin, fileErrorResponse, privateJson } from "@/lib/files/http";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { assertSameOrigin(request); const body = await request.json(); return privateJson(await finalizeUpload((await context.params).id, body.intentId)); }
  catch (error) { return fileErrorResponse(error); }
}
