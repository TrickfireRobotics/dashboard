import { redirect } from "next/navigation";

import { SettingsForm } from "@/components/settings/SettingsForm";
import { getSessionUser } from "@/lib/auth/session";

export default async function SettingsPage() {
    const user = await getSessionUser();
    if (!user) redirect("/login");

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl">Account settings</h1>
                <p className="text-muted-foreground">Update your name and email address.</p>
            </div>
            <SettingsForm name={user.name} email={user.email} />
        </div>
    );
}
