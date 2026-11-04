import { after } from "next/server";
import { dispatchMailOutbox } from "@/lib/mail-outbox";
import { changeManagedFile, downloadManagedFile } from "@/lib/files/service";
import { assertSameOrigin, fileErrorResponse, privateJson } from "@/lib/files/http";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  try { return await downloadManagedFile((await context.params).id); } catch (error) { return fileErrorResponse(error); }
}
export async function PATCH(request: Request, context: Context) {
  try { assertSameOrigin(request); const result = await changeManagedFile((await context.params).id, await request.json()); after(() => dispatchMailOutbox()); return privateJson(result); } catch (error) { return fileErrorResponse(error); }
}
