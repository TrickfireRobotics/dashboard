import { redirect } from "next/navigation";

import { SettingsForm } from "@/components/settings/SettingsForm";
import { getSessionUser } from "@/lib/auth/session";
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
        </div>
    );
}
