"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { JoinRequestStatusBadge } from "@/components/headscale/JoinRequestStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import type {
    HeadscaleApiKey,
    HeadscaleNode,
    HeadscaleRoute,
    HeadscaleUser,
} from "@/lib/headscale";
import { formatDate } from "@/lib/utils";
import type { JoinRequestStatus } from "@/lib/db/schema";

type JoinRequest = {
    id: number;
    deviceName: string;
    machineKey: string | null;
    status: JoinRequestStatus;
    requestNote: string | null;
    adminNote: string | null;
    createdAt: Date;
    requesterName: string | null;
};

type Tab = "nodes" | "users" | "routes" | "apikeys" | "requests";

function OnlineDot({ online }: { online: boolean }) {
    return (
        <span
            className={`inline-block size-2 rounded-full ${online ? "bg-primary" : "bg-muted-foreground/40"}`}
        />
    );
}

function relativeTime(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const s = Math.floor(ms / 1000);
    if (s < 60) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

function TabButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
            }`}
        >
            {children}
        </button>
    );
}

function NodesTab() {
    const [nodes, setNodes] = useState<HeadscaleNode[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/headscale/nodes", { cache: "no-store" });
            if (res.ok) setNodes((await res.json()).nodes ?? []);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    async function act(id: string, action: "delete" | "expire") {
        setBusy(id);
        try {
            const url =
                action === "delete"
                    ? `/api/admin/headscale/nodes/${id}`
                    : `/api/admin/headscale/nodes/${id}/expire`;
            const res = await fetch(url, {
                method: action === "delete" ? "DELETE" : "POST",
            });
            if (!res.ok) throw new Error("Action failed");
            toast.success(action === "delete" ? "Node deleted" : "Node key expired");
            load();
        } catch {
            toast.error("Action failed");
        } finally {
            setBusy(null);
        }
    }

    if (loading)
        return (
            <div className="space-y-3">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
            </div>
        );
    if (!nodes || nodes.length === 0)
        return <p className="text-muted-foreground text-sm">No nodes registered.</p>;

    return (
        <div className="border-border rounded-lg border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead></TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>IP Addresses</TableHead>
                        <TableHead>OS</TableHead>
                        <TableHead>Last seen</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {nodes.map((node) => (
                        <TableRow key={node.id}>
                            <TableCell>
                                <OnlineDot online={node.online} />
                            </TableCell>
                            <TableCell className="font-medium">{node.name}</TableCell>
                            <TableCell className="text-muted-foreground">
                                {node.user?.name ?? "-"}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                                {node.ipAddresses?.join(", ") ?? "-"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {node.os || "-"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {relativeTime(node.lastSeen)}
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={busy === node.id}
                                        onClick={() => act(node.id, "expire")}
                                    >
                                        Expire key
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        disabled={busy === node.id}
                                        onClick={() => act(node.id, "delete")}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function UsersTab() {
    const [users, setUsers] = useState<HeadscaleUser[] | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/admin/headscale/users", { cache: "no-store" })
            .then((r) => r.json())
            .then((d) => setUsers(d.users ?? []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading)
        return (
            <div className="space-y-3">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
            </div>
        );
    if (!users || users.length === 0)
        return <p className="text-muted-foreground text-sm">No users/namespaces found.</p>;

    return (
        <div className="border-border rounded-lg border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Created</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {users.map((u) => (
                        <TableRow key={u.id}>
                            <TableCell className="font-medium">{u.name}</TableCell>
                            <TableCell className="text-muted-foreground">
                                {formatDate(new Date(u.createdAt))}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function RoutesTab() {
    const [routes, setRoutes] = useState<HeadscaleRoute[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/headscale/routes", { cache: "no-store" });
            if (res.ok) setRoutes((await res.json()).routes ?? []);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    async function toggle(id: string, enabled: boolean) {
        setBusy(id);
        try {
            const res = await fetch("/api/admin/headscale/routes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: enabled ? "disable" : "enable", id }),
            });
            if (!res.ok) throw new Error();
            toast.success(enabled ? "Route disabled" : "Route enabled");
            load();
        } catch {
            toast.error("Action failed");
        } finally {
            setBusy(null);
        }
    }

    if (loading)
        return (
            <div className="space-y-3">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
            </div>
        );
    if (!routes || routes.length === 0)
        return <p className="text-muted-foreground text-sm">No routes advertised.</p>;

    return (
        <div className="border-border rounded-lg border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Prefix</TableHead>
                        <TableHead>Node</TableHead>
                        <TableHead>Advertised</TableHead>
                        <TableHead>Primary</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {routes.map((r) => (
                        <TableRow key={r.id}>
                            <TableCell className="font-mono">{r.prefix}</TableCell>
                            <TableCell className="text-muted-foreground">
                                {r.node?.name ?? "-"}
                            </TableCell>
                            <TableCell>
                                <Badge variant={r.advertised ? "default" : "secondary"}>
                                    {r.advertised ? "Yes" : "No"}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <Badge variant={r.isPrimary ? "default" : "secondary"}>
                                    {r.isPrimary ? "Primary" : "Backup"}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                <Button
                                    size="sm"
                                    variant={r.enabled ? "destructive" : "default"}
                                    disabled={busy === r.id}
                                    onClick={() => toggle(r.id, r.enabled)}
                                >
                                    {r.enabled ? "Disable" : "Enable"}
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

function ApiKeysTab() {
    const [apiKeys, setApiKeys] = useState<HeadscaleApiKey[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/headscale/apikeys", { cache: "no-store" });
            if (res.ok) setApiKeys((await res.json()).apiKeys ?? []);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    async function createKey() {
        setCreating(true);
        try {
            // 1-year expiry by default
            const expiration = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
            const res = await fetch("/api/admin/headscale/apikeys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ expiration }),
            });
            if (!res.ok) throw new Error();
            const data = await res.json();
            toast.success(`API key created: ${data.apiKey}`);
            load();
        } catch {
            toast.error("Failed to create API key");
        } finally {
            setCreating(false);
        }
    }

    async function expireKey(prefix: string) {
        setBusy(prefix);
        try {
            const res = await fetch(`/api/admin/headscale/apikeys/${prefix}/expire`, {
                method: "POST",
            });
            if (!res.ok) throw new Error();
            toast.success("API key expired");
            load();
        } catch {
            toast.error("Failed to expire API key");
        } finally {
            setBusy(null);
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button onClick={createKey} disabled={creating}>
                    {creating ? "Creating…" : "Create API key (1 year)"}
                </Button>
            </div>
            {loading ? (
                <div className="space-y-3">
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                </div>
            ) : !apiKeys || apiKeys.length === 0 ? (
                <p className="text-muted-foreground text-sm">No API keys found.</p>
            ) : (
                <div className="border-border rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Prefix</TableHead>
                                <TableHead>Expires</TableHead>
                                <TableHead>Last used</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {apiKeys.map((k) => (
                                <TableRow key={k.id}>
                                    <TableCell className="font-mono">{k.prefix}…</TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {formatDate(new Date(k.expiration))}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {k.lastSeen ? formatDate(new Date(k.lastSeen)) : "Never"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            disabled={busy === k.prefix}
                                            onClick={() => expireKey(k.prefix)}
                                        >
                                            Expire
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}

function JoinRequestsTab({ initial }: { initial: JoinRequest[] }) {
    const router = useRouter();
    const [busy, setBusy] = useState<number | null>(null);

    async function act(id: number, action: "approve" | "reject") {
        setBusy(id);
        try {
            const res = await fetch(`/api/admin/headscale/requests/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            if (!res.ok) throw new Error();
            toast.success(`Request ${action}d`);
            router.refresh();
        } catch {
            toast.error("Action failed");
        } finally {
            setBusy(null);
        }
    }

    if (initial.length === 0) {
        return (
            <div className="border-border text-muted-foreground rounded-lg border p-10 text-center">
                No join requests yet.
            </div>
        );
    }

    return (
        <div className="border-border rounded-lg border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Device</TableHead>
                        <TableHead>Requested by</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {initial.map((r) => (
                        <TableRow key={r.id}>
                            <TableCell>
                                <div>
                                    <p className="font-medium">{r.deviceName}</p>
                                    {r.machineKey && (
                                        <p className="text-muted-foreground font-mono text-xs">
                                            {r.machineKey}
                                        </p>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {r.requesterName ?? "-"}
                            </TableCell>
                            <TableCell className="text-muted-foreground max-w-40 whitespace-normal">
                                {r.requestNote ?? r.adminNote ?? "-"}
                            </TableCell>
                            <TableCell>
                                <JoinRequestStatusBadge status={r.status} />
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {formatDate(r.createdAt)}
                            </TableCell>
                            <TableCell className="text-right">
                                {r.status === "pending" ? (
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            disabled={busy === r.id}
                                            onClick={() => act(r.id, "reject")}
                                        >
                                            Reject
                                        </Button>
                                        <Button
                                            size="sm"
                                            disabled={busy === r.id}
                                            onClick={() => act(r.id, "approve")}
                                        >
                                            Approve
                                        </Button>
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground text-xs">-</span>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

export function AdminNetworkManager({ requests }: { requests: JoinRequest[] }) {
    const [tab, setTab] = useState<Tab>("nodes");

    const pendingCount = requests.filter((r) => r.status === "pending").length;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-1 border-b pb-3">
                <TabButton active={tab === "nodes"} onClick={() => setTab("nodes")}>
                    Nodes
                </TabButton>
                <TabButton active={tab === "users"} onClick={() => setTab("users")}>
                    Users
                </TabButton>
                <TabButton active={tab === "routes"} onClick={() => setTab("routes")}>
                    Routes
                </TabButton>
                <TabButton active={tab === "apikeys"} onClick={() => setTab("apikeys")}>
                    API Keys
                </TabButton>
                <TabButton active={tab === "requests"} onClick={() => setTab("requests")}>
                    Join Requests{pendingCount > 0 ? ` (${pendingCount})` : ""}
                </TabButton>
            </div>

            {tab === "nodes" && <NodesTab />}
            {tab === "users" && <UsersTab />}
            {tab === "routes" && <RoutesTab />}
            {tab === "apikeys" && <ApiKeysTab />}
            {tab === "requests" && <JoinRequestsTab initial={requests} />}
        </div>
    );
}
