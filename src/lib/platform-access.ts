import { and, eq } from "drizzle-orm";
import { db, type PlatformTx } from "@/db/client";
import { account, project, villa, buyer, buyerVilla, projectManager, pmProject } from "@/db/schema";
import { auth } from "@/lib/auth";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
export type PlatformActor = { id: string; role: "buyer" | "pm" | "developer"; email: string; displayName: string | null };
export class AccessError extends Error {
  constructor(message = "Access denied.", public status = 403) { super(message); }
}
export async function requireActor(developerOnly = false): Promise<PlatformActor> {
  const session = await auth();
  if (!session?.user?.id) throw new AccessError("Sign in to continue.", 401);
  const row = await db.query.account.findFirst({ where: eq(account.id, session.user.id) });
  if (!row || !["buyer", "pm", "developer"].includes(row.role) || (developerOnly && row.role !== "developer")) throw new AccessError();
  return { id: row.id, role: row.role as PlatformActor["role"], email: row.email, displayName: row.displayName };
}
export async function assertScope(tx: PlatformTx | typeof db, actor: PlatformActor, scope: { projectId: string; villaId?: string | null }, options: { developerOnly?: boolean } = {}) {
  const [current] = await tx.select().from(account).where(eq(account.id, actor.id));
  if (!current || current.role !== actor.role || (options.developerOnly && current.role !== "developer")) throw new AccessError();
  const [projectRow] = await tx.select().from(project).where(eq(project.id, scope.projectId));
  const [villaRow] = scope.villaId ? await tx.select().from(villa).where(and(eq(villa.id, scope.villaId), eq(villa.projectId, scope.projectId))) : [];
  if (!projectRow || (scope.villaId && !villaRow)) throw new AccessError();
  if (actor.role === "pm") {
    const rows = await tx.select({ id: pmProject.pmId }).from(pmProject).innerJoin(projectManager, eq(projectManager.id, pmProject.pmId)).where(and(eq(projectManager.accountId, actor.id), eq(pmProject.projectId, scope.projectId))).limit(1);
    if (!rows.length) throw new AccessError();
  } else if (actor.role === "buyer") {
    const rows = await tx.select({ id: buyer.id }).from(buyer).innerJoin(buyerVilla, eq(buyerVilla.buyerId, buyer.id)).innerJoin(villa, eq(villa.id, buyerVilla.villaId)).where(and(eq(buyer.accountId, actor.id), eq(villa.projectId, scope.projectId), scope.villaId ? eq(villa.id, scope.villaId) : undefined)).limit(1);
    if (!rows.length) throw new AccessError();
  }
  return { project: projectRow, villa: villaRow ?? null };
}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") throw new AccessError("This request could not be verified.");
}
export function apiError(error: unknown): Response {
  unstable_rethrow(error);
  if (error instanceof AccessError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof SyntaxError || error instanceof ZodError) return Response.json({ error: "Invalid request." }, { status: 400 });
  console.error("Platform request failed", error instanceof Error ? error.name : "UnknownError");
  return Response.json({ error: "The request could not be completed. Please try again." }, { status: 500 });
}
