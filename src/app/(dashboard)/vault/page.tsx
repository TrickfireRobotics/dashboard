import { desc } from "drizzle-orm";
import { redirect } from "next/navigation";

import { SimAccessCodePanel } from "@/components/sim/SimAccessCodePanel";
import { VaultManager } from "@/components/vault/VaultManager";
import type { VaultEntryRow } from "@/components/vault/VaultEntryDialog";
import { db } from "@/lib/db";
import { vaultEntry } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { getUnlockExpiry } from "@/lib/security/vault-unlock";
import { formatRotationTime, getAccessCode } from "@/lib/sim/access-code";

export default async function VaultPage() {
    const sessionUser = await getSessionUser();
    if (!sessionUser) redirect("/login");

    const entries: VaultEntryRow[] = db
        .select({
            id: vaultEntry.id,
            name: vaultEntry.name,
            description: vaultEntry.description,
            username: vaultEntry.username,
            createdAt: vaultEntry.createdAt,
        })
        .from(vaultEntry)
        .orderBy(desc(vaultEntry.createdAt))
        .all();

    const accessCode = getAccessCode();

    return (
        <div className="space-y-8">
            <SimAccessCodePanel
                code={accessCode.code}
                rotatesAt={accessCode.rotatesAt.toISOString()}
                rotatesAtLabel={formatRotationTime(accessCode.rotatesAt)}
            />

            <hr className="border-border" />

            <section className="space-y-4">
                <div>
                    <h2>Secret vault</h2>
                    <p className="text-muted-foreground text-sm">
                        Shared club credentials, encrypted at rest. Every member can reveal any
                        entry, but only right after confirming their password.
                    </p>
                </div>
                <VaultManager
                    entries={entries}
                    initialUnlockExpiresAt={await getUnlockExpiry(sessionUser.id)}
                />
            </section>
        </div>
    );
}
