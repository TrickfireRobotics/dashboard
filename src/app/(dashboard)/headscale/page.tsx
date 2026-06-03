import { redirect } from "next/navigation";

import { NetworkStatusCard } from "@/components/headscale/NetworkStatusCard";
import { NodeList } from "@/components/headscale/NodeList";
import { getSessionUser } from "@/lib/session";

export default async function HeadscalePage() {
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
        </div>
    );
}
