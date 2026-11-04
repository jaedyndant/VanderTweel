import { listManagedFiles } from "@/lib/files/service";
import { fileErrorResponse, privateJson } from "@/lib/files/http";
export async function GET(request: Request) {
  try { const params = new URL(request.url).searchParams; return privateJson(await listManagedFiles({ projectId: params.get("projectId"), villaId: params.get("villaId") || undefined }, Number(params.get("page") ?? 0))); }
  catch (error) { return fileErrorResponse(error); }
}
