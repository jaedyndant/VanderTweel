import { acceptLocalUpload } from "@/lib/files/service";
import { assertSameOrigin, fileErrorResponse, privateJson, readBoundedBytes } from "@/lib/files/http";
import { localStorageEnabled } from "@/lib/files/storage";
import { MAX_FILE_BYTES } from "@/lib/files/policy";
export async function PUT(request: Request, context: { params: Promise<{ intentId: string }> }) {
  if (!localStorageEnabled()) return new Response(null, { status: 404 });
  try { assertSameOrigin(request); await acceptLocalUpload((await context.params).intentId, await readBoundedBytes(request, MAX_FILE_BYTES)); return privateJson({ ok: true }); }
  catch (error) { return fileErrorResponse(error); }
}
