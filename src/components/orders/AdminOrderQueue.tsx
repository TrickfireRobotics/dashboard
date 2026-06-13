"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { OrderStatus } from "@/lib/db/schema";
import { formatDate, formatPriceCents } from "@/lib/utils";

import { OrderStatusBadge } from "./OrderStatusBadge";

export type AdminOrderRow = {
    id: number;
    itemName: string;
    teamName: string | null;
    requesterName: string | null;
    requesterEmail: string | null;
    quantity: number;
    unitPrice: number | null;
    vendorUrl: string | null;
    description: string | null;
    partType: string | null;
    partNumber: string | null;
    status: OrderStatus;
    adminNote: string | null;
    createdAt: Date;
};

type Action = "approve" | "ordered" | "reject";

export function AdminOrderQueue({ orders }: { orders: AdminOrderRow[] }) {
    const router = useRouter();
    const [selected, setSelected] = useState<AdminOrderRow | null>(null);
    const [note, setNote] = useState("");
    const [pending, setPending] = useState<Action | null>(null);

    function openReview(order: AdminOrderRow) {
        setSelected(order);
        setNote(order.adminNote ?? "");
        setPending(null);
    }

    async function runAction(action: Action) {
        if (!selected) return;
        setPending(action);
        try {
            const res = await fetch(`/api/orders/${selected.id}/action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, adminNote: note || undefined }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Action failed");
            }
            toast.success(`Order ${action === "ordered" ? "marked ordered" : `${action}d`}`);
            setSelected(null);
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
            setPending(null);
        }
    }

    if (orders.length === 0) {
        return (
            <div className="border-border text-muted-foreground rounded-lg border p-10 text-center">
                No orders submitted yet.
            </div>
        );
    }

    return (
        <>
            <div className="border-border rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead>Requester</TableHead>
                            <TableHead className="hidden md:table-cell">Team</TableHead>
                            <TableHead className="hidden text-right md:table-cell">Qty</TableHead>
                            <TableHead className="hidden text-right md:table-cell">
                                Unit price
                            </TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="hidden md:table-cell">Submitted</TableHead>
                            <TableHead className="text-right">Review</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.map((o) => (
                            <TableRow key={o.id}>
                                <TableCell className="text-foreground font-medium">
                                    {o.itemName}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                    {o.requesterName ?? o.requesterEmail ?? "-"}
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                    {o.teamName ?? "-"}
                                </TableCell>
                                <TableCell className="hidden text-right md:table-cell">
                                    {o.quantity}
                                </TableCell>
                                <TableCell className="hidden text-right md:table-cell">
                                    {formatPriceCents(o.unitPrice)}
                                </TableCell>
                                <TableCell>
                                    <OrderStatusBadge status={o.status} />
                                </TableCell>
                                <TableCell className="text-muted-foreground hidden md:table-cell">
                                    {formatDate(o.createdAt)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => openReview(o)}
                                    >
                                        {o.status === "pending" ? "Review" : "Update"}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <Dialog
                open={selected !== null}
                onOpenChange={(open) => {
                    if (!open) setSelected(null);
                }}
            >
                <DialogContent className="sm:max-w-lg">
                    {selected ? (
                        <>
                            <DialogHeader>
                                <DialogTitle>{selected.itemName}</DialogTitle>
                                <DialogDescription>
                                    Requested by{" "}
                                    {selected.requesterName ?? selected.requesterEmail ?? "unknown"}
                                    {selected.teamName ? ` · ${selected.teamName}` : ""}
                                </DialogDescription>
                            </DialogHeader>

                            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <Detail label="Quantity" value={String(selected.quantity)} />
                                <Detail
                                    label="Unit price"
                                    value={formatPriceCents(selected.unitPrice)}
                                />
                                <Detail label="Type" value={selected.partType ?? "-"} />
                                <Detail label="Part number" value={selected.partNumber ?? "-"} />
                                <div className="col-span-2">
                                    <dt className="text-muted-foreground">Vendor</dt>
                                    <dd>
                                        {selected.vendorUrl ? (
                                            <a
                                                href={selected.vendorUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-primary underline-offset-4 hover:underline"
                                            >
                                                {selected.vendorUrl}
                                            </a>
                                        ) : (
                                            "-"
                                        )}
                                    </dd>
                                </div>
                                {selected.description ? (
                                    <div className="col-span-2">
                                        <dt className="text-muted-foreground">Description</dt>
                                        <dd className="whitespace-pre-wrap">
                                            {selected.description}
                                        </dd>
                                    </div>
                                ) : null}
                            </dl>

                            <div className="space-y-2">
                                <Label htmlFor="admin-note">Admin note (optional)</Label>
                                <Textarea
                                    id="admin-note"
                                    rows={3}
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder="Reason for rejection, PO number, etc."
                                />
                            </div>

                            <div className="flex flex-wrap justify-end gap-2">
                                <Button
                                    variant="destructive"
                                    onClick={() => runAction("reject")}
                                    disabled={pending !== null}
                                >
                                    Reject
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => runAction("ordered")}
                                    disabled={pending !== null}
                                >
                                    Mark ordered
                                </Button>
                                <Button
                                    onClick={() => runAction("approve")}
                                    disabled={pending !== null}
                                >
                                    Approve
                                </Button>
                            </div>
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>
        </>
    );
}

function Detail({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-foreground">{value}</dd>
        </div>
    );
}
