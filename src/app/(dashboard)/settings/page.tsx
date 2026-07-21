import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { SettingsForm } from "@/components/settings/SettingsForm";
import { SimApiKeyPanel } from "@/components/settings/SimApiKeyPanel";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { apiKey } from "@/lib/db/schema";
import { NAME_CHANGE_COOLDOWN_MS } from "@/app/api/user/name/route";

function nameCooldownProps(nameChangedAt: number | null) {
    const now = Date.now();
    const onCooldown = nameChangedAt != null && now - nameChangedAt < NAME_CHANGE_COOLDOWN_MS;
    const cooldownUntil =
        onCooldown && nameChangedAt != null
            ? new Date(nameChangedAt + NAME_CHANGE_COOLDOWN_MS).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
              })
            : null;
    return { onCooldown, cooldownUntil };
}

export default async function SettingsPage() {
    const user = await getSessionUser();
    if (!user) redirect("/login");

    const { onCooldown, cooldownUntil } = nameCooldownProps(user.nameChangedAt ?? null);

    const cliKeys = db
        .select({
            prefix: apiKey.keyPrefix,
            name: apiKey.name,
            createdAt: apiKey.createdAt,
            lastUsedAt: apiKey.lastUsedAt,
        })
        .from(apiKey)
        .where(and(eq(apiKey.userId, user.id), eq(apiKey.isRevoked, false)))
        .orderBy(desc(apiKey.createdAt))
        .all();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl">Account settings</h1>
                <p className="text-muted-foreground">Update your name and email address.</p>
            </div>
            <SettingsForm
                name={user.name}
                email={user.email}
                onCooldown={onCooldown}
                cooldownUntil={cooldownUntil}
            />
            <SimApiKeyPanel initialKeys={cliKeys} />
        </div>
    );
}
