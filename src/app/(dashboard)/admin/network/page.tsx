import { AdminNetworkManager } from "@/components/network/AdminNetworkManager";

export default async function AdminNetworkPage() {
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
