"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { WhitelistStatusBadge } from "@/components/minecraft/WhitelistStatusBadge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import type { WhitelistStatus } from "@/lib/db/schema";
import { formatDate } from "@/lib/utils";

export type AdminWhitelistRow = {
    id: number;
    username: string;
    status: WhitelistStatus;
    requesterName: string | null;
    requestNote: string | null;
    adminNote: string | null;
    addedDirectly: boolean;
    createdAt: Date;
};

export function WhitelistManager({ requests }: { requests: AdminWhitelistRow[] }) {
    const router = useRouter();
    const [busy, setBusy] = useState<number | null>(null);
    const [removing, setRemoving] = useState<number | null>(null);

    async function act(id: number, action: "approve" | "reject") {
        setBusy(id);
        try {
            const res = await fetch(`/api/admin/whitelist/${id}/action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Action failed");
            }
            toast.success(`Request ${action}d`);
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setBusy(null);
        }
    }

    async function remove(id: number) {
        setRemoving(id);
        try {
            const res = await fetch(`/api/admin/whitelist/${id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Failed to remove");
            }
            toast.success("Removed from whitelist");
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setRemoving(null);
        }
    }

    return (
        <div className="space-y-6">
            {requests.length === 0 ? (
                <div className="border-border text-muted-foreground rounded-lg border p-10 text-center">
                    No whitelist requests yet.
                </div>
            ) : (
                <div className="border-border rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Username</TableHead>
                                <TableHead className="hidden md:table-cell">Requested by</TableHead>
                                <TableHead className="hidden md:table-cell">Source</TableHead>
                                <TableHead className="hidden md:table-cell">Note</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="hidden md:table-cell">Submitted</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {requests.map((r) => (
                                <TableRow key={r.id}>
                                    <TableCell className="text-foreground font-medium">
                                        {r.username}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground hidden md:table-cell">
                                        {r.requesterName ?? "-"}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground hidden md:table-cell">
                                        {r.addedDirectly ? "Direct add" : "Member request"}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground hidden max-w-40 whitespace-normal md:table-cell">
                                        {r.requestNote ?? r.adminNote ?? "-"}
                                    </TableCell>
                                    <TableCell>
                                        <WhitelistStatusBadge status={r.status} />
                                    </TableCell>
                                    <TableCell className="text-muted-foreground hidden md:table-cell">
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
                                        ) : r.status === "approved" ? (
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                disabled={removing === r.id}
                                                onClick={() => remove(r.id)}
                                            >
                                                {removing === r.id ? "Removing..." : "Remove"}
                                            </Button>
                                        ) : (
                                            <span className="text-muted-foreground text-xs">-</span>
                                        )}
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
