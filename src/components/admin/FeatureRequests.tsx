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
import { FEATURES } from "@/lib/features";
import { formatDate } from "@/lib/utils";

export type FeatureRequestRow = {
    id: number;
    userId: string;
    userName: string;
    userEmail: string;
    featureKey: string;
    requestNote: string | null;
    requestedAt: Date;
};

export function FeatureRequests({ requests }: { requests: FeatureRequestRow[] }) {
    const router = useRouter();
    const [busy, setBusy] = useState<number | null>(null);

    if (requests.length === 0) return null;

    async function act(id: number, action: "grant" | "reject") {
        setBusy(id);
        try {
            const res = await fetch(`/api/admin/features/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Action failed");
            }
            toast.success(action === "grant" ? "Access granted" : "Request rejected");
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
                <h2 className="text-lg font-semibold">Feature Requests</h2>
                <Badge variant="secondary">{requests.length}</Badge>
            </div>
            <div className="border-border rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Feature</TableHead>
                            <TableHead>Note</TableHead>
                            <TableHead>Requested</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {requests.map((r) => {
                            const featureLabel =
                                FEATURES[r.featureKey as keyof typeof FEATURES]?.label ??
                                r.featureKey;
                            return (
                                <TableRow key={r.id}>
                                    <TableCell>
                                        <p className="font-medium">{r.userName}</p>
                                        <p className="text-muted-foreground text-xs">
                                            {r.userEmail}
                                        </p>
                                    </TableCell>
                                    <TableCell>{featureLabel}</TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {r.requestNote ?? "-"}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {formatDate(r.requestedAt)}
                                    </TableCell>
                                    <TableCell className="text-right">
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
                                                onClick={() => act(r.id, "grant")}
                                            >
                                                Grant
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
