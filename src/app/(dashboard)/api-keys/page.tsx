import { asc, desc } from "drizzle-orm";
import { redirect } from "next/navigation";

import { VaultManager, type VaultMember } from "@/components/vault/VaultManager";
import type { VaultEntryRow } from "@/components/vault/VaultEntryDialog";
import { db } from "@/lib/db";
import { user, vaultEntry, vaultEntryAccess } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";

export default async function ApiKeysPage() {
    const sessionUser = await getSessionUser();
    if (!sessionUser) redirect("/login");

    const rows = db
        .select({
            id: vaultEntry.id,
            name: vaultEntry.name,
            type: vaultEntry.type,
            description: vaultEntry.description,
            username: vaultEntry.username,
            createdAt: vaultEntry.createdAt,
        })
        .from(vaultEntry)
        .orderBy(desc(vaultEntry.createdAt))
        .all();

    const entries: VaultEntryRow[] = rows;

    const members: VaultMember[] = db
        .select({ id: user.id, name: user.name, email: user.email })
        .from(user)
        .orderBy(asc(user.name))
        .all();

    const grants: Record<number, string[]> = {};
    for (const g of db
        .select({ entryId: vaultEntryAccess.entryId, userId: vaultEntryAccess.userId })
        .from(vaultEntryAccess)
        .all()) {
        (grants[g.entryId] ??= []).push(g.userId);
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl">API Keys</h1>
                <p className="text-muted-foreground">
                    A secret vault for the club&apos;s shared credentials. Create entries and manage
                    per-person access.
                </p>
            </div>

            <VaultManager entries={entries} members={members} grants={grants} />
        </div>
    );
}
