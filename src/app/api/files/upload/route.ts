import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { authorizeUploadToken } from "@/lib/files/service";
import { assertSameOrigin, fileErrorResponse, privateJson } from "@/lib/files/http";
import { FileError } from "@/lib/files/policy";
export async function POST(request: Request) {
  try {
    const body = await request.json() as HandleUploadBody;
    if (body.type === "blob.generate-client-token") assertSameOrigin(request);
    const response = await handleUpload({
      request, body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!clientPayload) throw new FileError("Missing upload intent.");
        const intent = await authorizeUploadToken(pathname, JSON.parse(clientPayload).intentId);
        return { allowedContentTypes: [intent.contentType], maximumSizeInBytes: intent.byteSize, validUntil: intent.expiresAt.getTime(), addRandomSuffix: false, allowOverwrite: false, cacheControlMaxAge: 60, tokenPayload: JSON.stringify({ intentId: intent.id }) };
      },
      // SDK verifies callback signatures. Completion is deliberately separate:
      // authenticated finalize checks actual bytes and the actor's current access.
      onUploadCompleted: async () => {},
    });
    return privateJson(response);
  } catch (error) { return fileErrorResponse(error); }
}
