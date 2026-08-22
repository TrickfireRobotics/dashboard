import { redirect } from "next/navigation";

import { AdminNetworkManager } from "@/components/network/AdminNetworkManager";
import { NetworkStatusCard } from "@/components/network/NetworkStatusCard";
import { getSessionUser } from "@/lib/auth/session";

export default async function NetworkPage() {
    const user = await getSessionUser();
    if (!user) redirect("/login");

    return (
        <div className="space-y-8">
            <NetworkStatusCard />

            <AdminNetworkManager />
        </div>
    );
}
