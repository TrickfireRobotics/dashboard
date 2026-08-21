import { redirect } from "next/navigation";

import { AdminNetworkManager } from "@/components/network/AdminNetworkManager";
import { NetworkStatusCard } from "@/components/network/NetworkStatusCard";
import { NodeList } from "@/components/network/NodeList";
import { getSessionUser } from "@/lib/auth/session";

export default async function NetworkPage() {
    const user = await getSessionUser();
    if (!user) redirect("/login");

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl">Network</h1>
                <p className="text-muted-foreground">TrickFire private network status.</p>
            </div>

            <NetworkStatusCard />
            <NodeList />

            <section className="space-y-4">
                <div>
                    <h2 className="text-lg font-semibold">Device management</h2>
                    <p className="text-muted-foreground text-sm">Manage Tailscale devices.</p>
                </div>
                <AdminNetworkManager />
            </section>
        </div>
    );
}
