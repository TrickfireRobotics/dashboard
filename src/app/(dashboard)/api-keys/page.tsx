import { asc, desc } from "drizzle-orm";
import { redirect } from "next/navigation";

import { VaultManager, type VaultMember } from "@/components/vault/VaultManager";
import type { VaultEntryRow } from "@/components/vault/VaultEntryDialog";
import { db } from "@/lib/db";
import { user, vaultEntry, vaultEntryAccess } from "@/lib/db/schema";
import { canUseVault, getSessionUser } from "@/lib/session";

export default async function ApiKeysPage() {
    const sessionUser = await getSessionUser();
    if (!sessionUser) redirect("/login");
    if (!canUseVault(sessionUser)) redirect("/dashboard");

    const isAdmin = sessionUser.role === "admin";

    // Metadata only - login secrets are fetched on demand via
    // /api/vault/[id]/reveal; api_key secrets via /api/vault/[id]/key.
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

    // Admins manage per-person grants, so load the member roster and the current
    // grants (entryId -> userIds). Members don't need either.
    let members: VaultMember[] = [];
    const grants: Record<number, string[]> = {};
    if (isAdmin) {
        members = db
            .select({ id: user.id, name: user.name, email: user.email, role: user.role })
            .from(user)
            .orderBy(asc(user.name))
            .all()
            .map((m) => ({
                id: m.id,
                name: m.name,
                email: m.email,
                isAdmin: m.role === "admin",
            }));

        for (const g of db
            .select({ entryId: vaultEntryAccess.entryId, userId: vaultEntryAccess.userId })
            .from(vaultEntryAccess)
            .all()) {
            (grants[g.entryId] ??= []).push(g.userId);
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl">API Keys</h1>
                <p className="text-muted-foreground">
                    A secret vault for the club&apos;s shared credentials.
                    {isAdmin
                        ? " Create entries and manage per-person access."
                        : " Reveal logins, or fetch API keys from their endpoint."}
                </p>
            </div>

            <VaultManager
                entries={entries}
                isAdmin={isAdmin}
                members={members}
                grants={grants}
            />
        </div>
    );
}
