import { createUploadIntent } from "@/lib/files/service";
import { assertSameOrigin, fileErrorResponse, privateJson } from "@/lib/files/http";
export async function POST(request: Request) {
  try { assertSameOrigin(request); return privateJson(await createUploadIntent(await request.json()), 201); }
  catch (error) { return fileErrorResponse(error); }
}
