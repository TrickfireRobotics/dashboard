import { AdminNetworkManager } from "@/components/headscale/AdminNetworkManager";

export default async function AdminHeadscalePage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl">Network</h1>
                <p className="text-muted-foreground">Manage Tailscale devices.</p>
            </div>

            <AdminNetworkManager />
        </div>
    );
}
