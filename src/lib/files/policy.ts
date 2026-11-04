import { z } from "zod";

export class FileError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const FILE_TYPES = { "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"], "image/webp": ["webp"], "application/pdf": ["pdf"] } as const;
export const scopeSchema = z.object({ projectId: z.uuid(), villaId: z.uuid().optional() });
export const intentSchema = scopeSchema.extend({
  kind: z.enum(["doc", "photo"]), label: z.string().trim().min(1).max(200), note: z.string().trim().max(2000).default(""),
  fileName: z.string().trim().min(1).max(180), contentType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
  byteSize: z.number().int().positive().max(MAX_FILE_BYTES),
  assetId: z.uuid().optional(), expectedRevision: z.number().int().positive().optional(),
}).superRefine((data, ctx) => {
  if (Boolean(data.assetId) !== Boolean(data.expectedRevision)) ctx.addIssue({ code: "custom", message: "Replacement requires the current revision." });
  if ((data.kind === "photo") !== data.contentType.startsWith("image/")) ctx.addIssue({ code: "custom", message: "Choose a matching file type." });
  if (data.kind === "photo" && data.byteSize > MAX_PHOTO_BYTES) ctx.addIssue({ code: "custom", message: "Photos must be 15 MB or smaller." });
  const extension = data.fileName.split(".").at(-1)?.toLowerCase() ?? "";
  if (!(FILE_TYPES[data.contentType] as readonly string[]).includes(extension)) ctx.addIssue({ code: "custom", message: "The file extension does not match its format." });
  if (/[\\/\x00-\x1f\x7f]/.test(data.fileName)) ctx.addIssue({ code: "custom", message: "The file name is invalid." });
});
export type UploadInput = z.infer<typeof intentSchema>;
export const patchSchema = z.object({
  expectedRevision: z.number().int().positive(),
  action: z.enum(["share", "hide", "archive", "restore", "rename"]),
  label: z.string().trim().min(1).max(200).optional(), note: z.string().trim().max(2000).optional(),
});
export function assertPhotoPermission(role: string, kind: string) {
  if (role !== "developer" && (role !== "pm" || kind !== "photo")) throw new FileError("This file is not available to your account.", 403);
}
export function assertFileSignature(contentType: string, bytes: Uint8Array) {
  const starts = (...prefix: number[]) => prefix.every((value, index) => bytes[index] === value);
  const text = (start: number, end: number) => new TextDecoder().decode(bytes.slice(start, end));
  const valid = contentType === "image/jpeg" ? starts(0xff, 0xd8, 0xff)
    : contentType === "image/png" ? starts(137, 80, 78, 71, 13, 10, 26, 10)
    : contentType === "image/webp" ? text(0, 4) === "RIFF" && text(8, 12) === "WEBP"
    : contentType === "application/pdf" ? text(0, 5) === "%PDF-" : false;
  if (!valid) throw new FileError("The uploaded content does not match its file format.");
}
export function assertIntentUsable(intent: { actorId: string; expiresAt: Date; finalizedAt: Date | null }, actorId: string, now = new Date()) {
  if (intent.actorId !== actorId) throw new FileError("Upload not found.", 404);
  if (intent.finalizedAt) throw new FileError("This upload is already complete.", 409);
  if (intent.expiresAt <= now) throw new FileError("This upload has expired. Choose the file again.", 410);
}
export function assertRevision(actual: number, expected: number) {
  if (actual !== expected) throw new FileError("This file changed in another session. Refresh before saving.", 409);
}
export function privateFileHeaders(contentType: string, fileName: string, photo: boolean) {
  return {
    "Content-Type": contentType,
    "Content-Disposition": `${photo ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(fileName).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16)}`)}`,
    "Cache-Control": "private, no-store, max-age=0",
    "Pragma": "no-cache", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'", "Cross-Origin-Resource-Policy": "same-origin",
  };
}
