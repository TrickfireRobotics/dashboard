import { redirect } from "next/navigation";

import { AdminNetworkManager } from "@/components/network/AdminNetworkManager";
import { NetworkStatusCard } from "@/components/network/NetworkStatusCard";
import { getSessionUser } from "@/lib/auth/session";

export default async function NetworkPage() {
    const user = await getSessionUser();
    if (!user) redirect("/login");

    return (
        <div className="space-y-6">
            <NetworkStatusCard />

            <section className="space-y-4">
                <div>
                    <h2>Devices</h2>
                    <p className="text-muted-foreground text-sm">Manage Tailscale devices.</p>
                </div>
                <AdminNetworkManager />
            </section>
        </div>
    );
}
