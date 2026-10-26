import { eq, and } from "drizzle-orm";
import type { Adapter, AdapterUser, AdapterSession } from "@auth/core/adapters";
import { db } from "@/db/client";
import { account, session as sessionTable, verificationToken } from "@/db/schema";

// Seed data and lookups both normalize to lowercase/trimmed — emails are
// case-insensitive identifiers by convention here, not enforced by Postgres.
function normalize(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * TO 9.1: no self-registration. Every account (buyer/pm/developer) is
 * provisioned in advance by the team; the magic-link flow only ever issues a
 * link to an email that already has a row in `account`. Called from the
 * Auth.js `signIn` callback (src/lib/auth.ts) before a token is ever sent.
 */
export async function isKnownAccountEmail(email: string): Promise<boolean> {
  const row = await db.query.account.findFirst({
    where: eq(account.email, normalize(email)),
  });
  return row !== undefined;
}

/**
 * Look up the role for an already-authenticated email, used by the session
 * callback to stamp the role onto the session (TO 9.1: role decides which
 * surface opens — there is no role picker on the login screen).
 */
export async function getAccountRole(email: string) {
  const row = await db.query.account.findFirst({
    where: eq(account.email, normalize(email)),
  });
  return row?.role as "buyer" | "pm" | "developer" | undefined;
}

function toAdapterUser(row: typeof account.$inferSelect): AdapterUser {
  return {
    id: row.id,
    email: row.email,
    // The schema has no emailVerified column by design (TO 9.1: no
    // passwords, no separate verification step — a consumed magic-link
    // token IS the verification). Auth.js's type wants the field present.
    emailVerified: null,
    name: null,
    image: null,
  };
}

/**
 * Hand-written Adapter (not @auth/drizzle-adapter) so the database-session +
 * magic-link flow maps directly onto the TO ch.7 `account` table instead of
 * requiring a second, redundant `users` table. The critical property this
 * buys us: `createUser` below NEVER inserts a new account — TO 9.1 is
 * explicit that there is no self-registration, every account is seeded by
 * the team in advance. If Auth.js's email flow ever reaches createUser it
 * means a verification token was issued for an email with no account, which
 * should already be impossible because of the `signIn` callback's
 * `isKnownAccountEmail` gate — this is the defense-in-depth backstop.
 */
export function buildAuthAdapter(): Adapter {
  return {
    async getUser(id) {
      const row = await db.query.account.findFirst({ where: eq(account.id, id) });
      return row ? toAdapterUser(row) : null;
    },
    async getUserByEmail(email) {
      const row = await db.query.account.findFirst({
        where: eq(account.email, normalize(email)),
      });
      return row ? toAdapterUser(row) : null;
    },
    async createUser() {
      throw new Error(
        "createUser blocked: TO 9.1 — no self-registration, every account is pre-seeded."
      );
    },
    async updateUser(user) {
      const row = await db.query.account.findFirst({ where: eq(account.id, user.id) });
      if (!row) throw new Error(`updateUser: no account with id ${user.id}`);
      return toAdapterUser(row);
    },
    async deleteUser() {
      throw new Error("deleteUser not supported: accounts are managed outside the auth flow.");
    },
    async linkAccount() {
      // No OAuth providers in this project (TO 3.2: magic-link only) — no-op.
      return undefined;
    },
    async unlinkAccount() {
      return undefined;
    },
    async createSession({ sessionToken, userId, expires }) {
      await db.insert(sessionTable).values({
        sessionToken,
        accountId: userId,
        expires,
      });
      return { sessionToken, userId, expires };
    },
    async getSessionAndUser(sessionToken) {
      const row = await db.query.session.findFirst({
        where: eq(sessionTable.sessionToken, sessionToken),
      });
      if (!row) return null;
      const userRow = await db.query.account.findFirst({ where: eq(account.id, row.accountId) });
      if (!userRow) return null;
      const adapterSession: AdapterSession = {
        sessionToken: row.sessionToken,
        userId: row.accountId,
        expires: row.expires,
      };
      return { session: adapterSession, user: toAdapterUser(userRow) };
    },
    async updateSession({ sessionToken, expires }) {
      if (!expires) return null;
      await db
        .update(sessionTable)
        .set({ expires })
        .where(eq(sessionTable.sessionToken, sessionToken));
      return undefined;
    },
    async deleteSession(sessionToken) {
      await db.delete(sessionTable).where(eq(sessionTable.sessionToken, sessionToken));
    },
    async createVerificationToken({ identifier, token, expires }) {
      await db.insert(verificationToken).values({ identifier: normalize(identifier), token, expires });
      return { identifier, token, expires };
    },
    async useVerificationToken({ identifier, token }) {
      const row = await db.query.verificationToken.findFirst({
        where: and(
          eq(verificationToken.identifier, normalize(identifier)),
          eq(verificationToken.token, token)
        ),
      });
      if (!row) return null;
      // One-time use (TO 9.2): delete on successful read so it can never be
      // replayed, regardless of whether it has expired.
      await db
        .delete(verificationToken)
        .where(
          and(
            eq(verificationToken.identifier, row.identifier),
            eq(verificationToken.token, row.token)
          )
        );
      return row;
    },
  };
}
