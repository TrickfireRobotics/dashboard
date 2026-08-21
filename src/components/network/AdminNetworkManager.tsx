"use client";

import { CircleHelp, Smartphone } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { AppleIcon, LinuxIcon, WindowsIcon } from "@/components/icons/os-icons";
import { Button } from "@/components/ui/button";
import { DataTableCard, DataTableCardHeader } from "@/components/ui/data-table-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import type { NetworkNode } from "@/lib/integrations/network";
import { usePoll } from "@/lib/use-poll";

function OnlineDot({ online }: { online: boolean }) {
    return (
        <span
            className={`inline-block size-2 rounded-full ${online ? "bg-primary" : "bg-muted-foreground/40"}`}
        />
    );
}

function OsIcon({ os }: { os: string }) {
    const lower = os.toLowerCase();
    const className = "text-foreground size-4 shrink-0";
    if (lower.includes("mac") || lower.includes("darwin"))
        return <AppleIcon className={className} />;
    if (lower.includes("ios") || lower.includes("android"))
        return <Smartphone className={className} />;
    if (lower.includes("windows")) return <WindowsIcon className={className} />;
    if (lower.includes("linux")) return <LinuxIcon className={className} />;
    return <CircleHelp className="text-muted-foreground size-4 shrink-0" />;
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

export function AdminNetworkManager() {
    const [nodes, setNodes] = useState<NetworkNode[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/network/nodes", { cache: "no-store" });
            if (res.ok) setNodes((await res.json()).nodes ?? []);
        } finally {
            setLoading(false);
        }
    }, []);

    usePoll(load);

    async function deleteDevice(id: string) {
        setBusy(id);
        try {
            const res = await fetch(`/api/admin/network/nodes/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error();
            toast.success("Device removed");
            load();
        } catch {
            toast.error("Failed to remove device");
        } finally {
            setBusy(null);
        }
    }

    return (
        <DataTableCard>
            <DataTableCardHeader title="Devices" description="Manage Tailscale devices." />
            {loading ? (
                <div className="space-y-3 p-4">
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                </div>
            ) : !nodes || nodes.length === 0 ? (
                <EmptyState
                    className="border-none"
                    icon={CircleHelp}
                    title="No devices registered"
                    description="Devices show up here once they join the Tailscale network."
                />
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="pl-4"></TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead className="hidden md:table-cell">IP Addresses</TableHead>
                            <TableHead className="hidden whitespace-nowrap md:table-cell">
                                Last seen
                            </TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {nodes.map((node) => (
                            <TableRow key={node.id}>
                                <TableCell className="pl-4">
                                    <OnlineDot online={node.online} />
                                </TableCell>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <OsIcon os={node.os} />
                                        {node.name}
                                    </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                    {node.user?.name ?? "-"}
                                </TableCell>
                                <TableCell className="hidden font-mono text-xs md:table-cell">
                                    {node.ipAddresses?.join(", ") ?? "-"}
                                </TableCell>
                                <TableCell className="text-muted-foreground hidden whitespace-nowrap md:table-cell">
                                    {relativeTime(node.lastSeen)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        disabled={busy === node.id}
                                        onClick={() => deleteDevice(node.id)}
                                    >
                                        Remove
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </DataTableCard>
    );
}
