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

export type ApiKeyRow = {
    id: number;
    name: string;
    keyPrefix: string;
    lastUsedAt: Date | null;
    isRevoked: boolean;
    createdAt: Date;
};

export function ApiKeyList({ keys }: { keys: ApiKeyRow[] }) {
    const router = useRouter();
    const [revoking, setRevoking] = useState<number | null>(null);

    async function revoke(id: number) {
        setRevoking(id);
        try {
            const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Failed to revoke key");
            }
            toast.success("Key revoked");
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setRevoking(null);
        }
    }

    if (keys.length === 0) {
        return (
            <div className="border-border text-muted-foreground rounded-lg border p-10 text-center">
                No API keys yet. Create one for your sim scripts.
            </div>
        );
    }

    return (
        <div className="border-border rounded-lg border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Prefix</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Last used</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {keys.map((k) => (
                        <TableRow key={k.id}>
                            <TableCell className="text-foreground font-medium">{k.name}</TableCell>
                            <TableCell>
                                <code className="text-muted-foreground text-xs">
                                    {k.keyPrefix}…
                                </code>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {formatDate(k.createdAt)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {k.lastUsedAt ? formatDate(k.lastUsedAt) : "Never"}
                            </TableCell>
                            <TableCell>
                                {k.isRevoked ? (
                                    <Badge variant="destructive">Revoked</Badge>
                                ) : (
                                    <Badge variant="default">Active</Badge>
                                )}
                            </TableCell>
                            <TableCell className="text-right">
                                {k.isRevoked ? (
                                    <span className="text-muted-foreground text-xs">-</span>
                                ) : (
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => revoke(k.id)}
                                        disabled={revoking === k.id}
                                    >
                                        {revoking === k.id ? "Revoking..." : "Revoke"}
                                    </Button>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
