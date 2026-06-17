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

// Whether the user can open the vault page at all. Admins always; members need
// the global grant. Per-secret access is then gated by canReadVaultEntry.
export function canUseVault(user: Pick<SessionUser, "role" | "canAccessVault">): boolean {
    return user.role === "admin" || user.canAccessVault === true;
}

// Per-entry access to a vault secret (login reveal or api_key fetch). Admins
// always qualify; everyone else needs an explicit grant in vault_entry_access.
export function canReadVaultEntry(
    user: Pick<SessionUser, "id" | "role">,
    entryId: number
): boolean {
    if (user.role === "admin") return true;
    const grant = db
        .select({ id: vaultEntryAccess.id })
        .from(vaultEntryAccess)
        .where(and(eq(vaultEntryAccess.entryId, entryId), eq(vaultEntryAccess.userId, user.id)))
        .get();
    return grant !== undefined;
}
