"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

export type PendingUserRow = {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
};

export function PendingApprovals({ users }: { users: PendingUserRow[] }) {
    const router = useRouter();
    const [busy, setBusy] = useState<string | null>(null);

    if (users.length === 0) return null;

    async function approve(id: string) {
        setBusy(id);
        try {
            const res = await fetch(`/api/admin/users/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ approved: true }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Failed to approve");
            }
            toast.success("User approved");
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setBusy(null);
        }
    }

    async function reject(id: string) {
        setBusy(id);
        try {
            const res = await fetch(`/api/admin/users/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: false }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Failed to reject");
            }
            toast.success("User rejected");
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setBusy(null);
        }
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Pending Approvals</h2>
                <Badge variant="destructive">{users.length}</Badge>
            </div>
            <div className="border-border rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Registered</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((u) => (
                            <TableRow key={u.id}>
                                <TableCell className="font-medium">{u.name}</TableCell>
                                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                                <TableCell className="text-muted-foreground whitespace-nowrap">
                                    {formatDate(u.createdAt)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            disabled={busy === u.id}
                                            onClick={() => reject(u.id)}
                                        >
                                            Reject
                                        </Button>
                                        <Button
                                            size="sm"
                                            disabled={busy === u.id}
                                            onClick={() => approve(u.id)}
                                        >
                                            Approve
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
