"use client";

import { CircleHelp } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { OsIcon } from "@/components/network/OsIcon";
import { Button } from "@/components/ui/button";
import { DataTableCard } from "@/components/ui/data-table-card";
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
import { formatRelativeTime } from "@/lib/utils";

function OnlineDot({ online }: { online: boolean }) {
    return (
        <span
            className={`inline-block size-2 rounded-full ${online ? "bg-primary" : "bg-muted-foreground/40"}`}
        />
    );
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
                                    {formatRelativeTime(node.lastSeen)}
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
