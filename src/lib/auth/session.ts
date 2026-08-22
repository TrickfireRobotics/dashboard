import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";

import { auth } from "./auth";
import { db } from "../db";
import { vaultEntryAccess } from "../db/schema";

export type SessionUser = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>["user"];

export async function getSessionUser(): Promise<SessionUser | null> {
    const session = await auth.api.getSession({ headers: await headers() });
    return session?.user ?? null;
}

// Per-entry access to a vault secret (login reveal or api_key fetch). Everyone
// can open the vault page; reading a specific secret still needs an explicit
// grant in vault_entry_access.
export function canReadVaultEntry(user: Pick<SessionUser, "id">, entryId: number): boolean {
    const grant = db
        .select({ id: vaultEntryAccess.id })
        .from(vaultEntryAccess)
        .where(and(eq(vaultEntryAccess.entryId, entryId), eq(vaultEntryAccess.userId, user.id)))
        .get();
    return grant !== undefined;
}
