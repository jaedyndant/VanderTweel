import { ZodError } from "zod";
import { unstable_rethrow } from "next/navigation";
import { FileError } from "./policy";
import { AccessError } from "@/lib/platform-access";

export const privateJson = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") throw new FileError("This request is not allowed.", 403);
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("application/json") && !contentType.startsWith("application/octet-stream")) throw new FileError("Unsupported request format.", 415);
}
export function fileErrorResponse(error: unknown) {
  unstable_rethrow(error);
  if (error instanceof AccessError) return privateJson({ error: error.message }, error.status);
  if (error instanceof FileError) return privateJson({ error: error.message }, error.status);
  if (error instanceof ZodError) return privateJson({ error: error.issues[0]?.message ?? "Invalid input." }, 400);
  // Never expose database details, Blob store URLs, tokens, or exception stacks.
  return privateJson({ error: "The file action could not be completed. Refresh and try again." }, 400);
}
export async function readBoundedBytes(request: Request, maximum: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new FileError("Choose a file.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length; if (size > maximum) throw new FileError("File is too large.", 413);
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const output = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}
