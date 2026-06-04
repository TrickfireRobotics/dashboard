import { desc } from "drizzle-orm";
import { redirect } from "next/navigation";

import { VaultManager } from "@/components/vault/VaultManager";
import type { VaultEntryRow } from "@/components/vault/VaultEntryDialog";
import { db } from "@/lib/db";
import { vaultEntry } from "@/lib/db/schema";
import { canUseVault, getSessionUser } from "@/lib/session";

export default async function ApiKeysPage() {
    const user = await getSessionUser();
    if (!user) redirect("/login");
    if (!canUseVault(user)) redirect("/dashboard");

    const isAdmin = user.role === "admin";

    // Metadata only - secrets are fetched on demand via /api/vault/[id]/reveal.
    const rows = db
        .select({
            id: vaultEntry.id,
            name: vaultEntry.name,
            type: vaultEntry.type,
            description: vaultEntry.description,
            username: vaultEntry.username,
            easyCopy: vaultEntry.easyCopy,
            createdAt: vaultEntry.createdAt,
        })
        .from(vaultEntry)
        .orderBy(desc(vaultEntry.createdAt))
        .all();

    const entries: VaultEntryRow[] = rows;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl">API Keys</h1>
                <p className="text-muted-foreground">
                    A secret vault for the club&apos;s shared credentials.
                    {isAdmin
                        ? " Create entries and grant access from the Users page."
                        : " Reveal or copy the secrets you need."}
                </p>
            </div>

            <VaultManager entries={entries} isAdmin={isAdmin} />
        </div>
    );
}
