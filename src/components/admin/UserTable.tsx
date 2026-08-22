"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableCard, DataTableCardHeader } from "@/components/ui/data-table-card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

export type AdminUserRow = {
    id: string;
    name: string;
    email: string;
    isActive: boolean;
    createdAt: Date;
};

export function UserTable({
    users,
    currentUserId,
}: {
    users: AdminUserRow[];
    currentUserId: string;
}) {
    const router = useRouter();
    const [busy, setBusy] = useState<string | null>(null);

    async function patchUser(id: string, body: Record<string, unknown>) {
        setBusy(id);
        try {
            const res = await fetch(`/api/admin/users/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Update failed");
            }
            toast.success("User updated");
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setBusy(null);
        }
    }

    return (
        <DataTableCard>
            <DataTableCardHeader title="Members" description={`${users.length} approved members`} />
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden md:table-cell">Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden md:table-cell">Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {users.map((u) => {
                        const isSelf = u.id === currentUserId;
                        return (
                            <TableRow key={u.id}>
                                <TableCell className="text-foreground font-medium">
                                    {u.name}
                                    {isSelf ? (
                                        <span className="text-muted-foreground ml-2 text-xs">
                                            (you)
                                        </span>
                                    ) : null}
                                </TableCell>
                                <TableCell className="text-muted-foreground hidden md:table-cell">
                                    {u.email}
                                </TableCell>
                                <TableCell>
                                    {u.isActive ? (
                                        <Badge variant="default">Active</Badge>
                                    ) : (
                                        <Badge variant="destructive">Deactivated</Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-muted-foreground hidden whitespace-nowrap md:table-cell">
                                    {formatDate(u.createdAt)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        size="sm"
                                        variant={u.isActive ? "destructive" : "outline"}
                                        disabled={isSelf || busy === u.id}
                                        onClick={() => patchUser(u.id, { isActive: !u.isActive })}
                                    >
                                        {u.isActive ? "Deactivate" : "Activate"}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </DataTableCard>
    );
}
