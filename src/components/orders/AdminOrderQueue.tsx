"use client";

import { Copy } from "lucide-react";
import { Fragment } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import type { FundType, OrderStatus } from "@/lib/db/schema";
import {
    formatApprovedGiftOrders,
    formatApprovedStfOrders,
    formatOrderForExcel,
} from "@/lib/finance/order-export";
import { formatDate, formatPriceCents } from "@/lib/utils";

import { OrderStatusBadge } from "./OrderStatusBadge";

export type AdminOrderRow = {
    id: number;
    itemName: string;
    fundType: FundType;
    stfBucketName: string | null;
    requesterName: string | null;
    requesterEmail: string | null;
    quantity: number;
    unitCostCents: number;
    vendor: string;
    link: string;
    notes: string | null;
    partNumber: string | null;
    status: OrderStatus;
    denialComment: string | null;
    createdAt: Date;
};

type Action = "approve" | "deny";

function totalCostCents(row: { quantity: number; unitCostCents: number }) {
    return row.quantity * row.unitCostCents;
}

async function copyText(text: string, label: string) {
    if (!text) {
        toast.error("Nothing to copy");
        return;
    }
    try {
        await navigator.clipboard.writeText(text);
        toast.success(`Copied ${label} for Excel`);
    } catch {
        toast.error("Could not copy to clipboard");
    }
}

export function AdminOrderQueue({ orders }: { orders: AdminOrderRow[] }) {
    const router = useRouter();
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [denialComment, setDenialComment] = useState("");
    const [pending, setPending] = useState<Action | null>(null);

    const pendingOrders = orders.filter((o) => o.status === "pending");
    const otherOrders = orders.filter((o) => o.status !== "pending");
    const approvedStfCount = orders.filter(
        (o) => o.status === "approved" && o.fundType === "STF"
    ).length;
    const approvedGiftCount = orders.filter(
        (o) => o.status === "approved" && o.fundType === "Gift"
    ).length;

    async function runAction(order: AdminOrderRow, action: Action) {
        setPending(action);
        try {
            const res = await fetch(`/api/orders/${order.id}/action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action,
                    denialComment: action === "deny" ? denialComment || undefined : undefined,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Action failed");
            }
            toast.success(action === "approve" ? "Order approved" : "Order denied");
            setExpandedId(null);
            setDenialComment("");
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
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
        <div className="space-y-8">
            {(approvedStfCount > 0 || approvedGiftCount > 0) && (
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={approvedStfCount === 0}
                        onClick={() =>
                            copyText(
                                formatApprovedStfOrders(orders),
                                `${approvedStfCount} approved STF order${approvedStfCount === 1 ? "" : "s"}`
                            )
                        }
                    >
                        <Copy className="size-4" />
                        Copy all approved STF ({approvedStfCount})
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={approvedGiftCount === 0}
                        onClick={() =>
                            copyText(
                                formatApprovedGiftOrders(orders),
                                `${approvedGiftCount} approved Gift order${approvedGiftCount === 1 ? "" : "s"}`
                            )
                        }
                    >
                        <Copy className="size-4" />
                        Copy all approved Gift ({approvedGiftCount})
                    </Button>
                </div>
            )}
            <OrderSection
                title="Pending orders"
                orders={pendingOrders}
                expandedId={expandedId}
                onToggle={(id) => {
                    setExpandedId((prev) => (prev === id ? null : id));
                    setDenialComment("");
                }}
                denialComment={denialComment}
                onDenialCommentChange={setDenialComment}
                pending={pending}
                onAction={runAction}
                showActions
            />
            {otherOrders.length > 0 ? (
                <OrderSection
                    title="Archive"
                    orders={otherOrders}
                    expandedId={expandedId}
                    onToggle={(id) => setExpandedId((prev) => (prev === id ? null : id))}
                    denialComment={denialComment}
                    onDenialCommentChange={setDenialComment}
                    pending={pending}
                    onAction={runAction}
                    showActions={false}
                />
            ) : null}
        </div>
    );
}

function OrderSection({
    title,
    orders,
    expandedId,
    onToggle,
    denialComment,
    onDenialCommentChange,
    pending,
    onAction,
    showActions,
}: {
    title: string;
    orders: AdminOrderRow[];
    expandedId: number | null;
    onToggle: (id: number) => void;
    denialComment: string;
    onDenialCommentChange: (v: string) => void;
    pending: Action | null;
    onAction: (order: AdminOrderRow, action: Action) => void;
    showActions: boolean;
}) {
    if (orders.length === 0) return null;

    return (
        <div className="space-y-3">
            <h2 className="text-lg font-semibold">{title}</h2>
            <div className="border-border rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Submitted by</TableHead>
                            <TableHead>Item</TableHead>
                            <TableHead className="hidden md:table-cell">Fund / bucket</TableHead>
                            <TableHead className="hidden text-right md:table-cell">
                                Total cost
                            </TableHead>
                            <TableHead className="hidden md:table-cell">Date submitted</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.map((o) => {
                            const expanded = expandedId === o.id;
                            return (
                                <Fragment key={o.id}>
                                    <TableRow
                                        key={o.id}
                                        className="cursor-pointer"
                                        onClick={() => onToggle(o.id)}
                                    >
                                        <TableCell className="text-muted-foreground">
                                            {o.requesterName ?? o.requesterEmail ?? "-"}
                                        </TableCell>
                                        <TableCell className="text-foreground font-medium">
                                            {o.itemName}
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            {o.fundType}
                                            {o.stfBucketName ? ` · ${o.stfBucketName}` : ""}
                                        </TableCell>
                                        <TableCell className="hidden text-right md:table-cell">
                                            {formatPriceCents(totalCostCents(o))}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground hidden md:table-cell">
                                            {formatDate(o.createdAt)}
                                        </TableCell>
                                        <TableCell>
                                            <OrderStatusBadge status={o.status} />
                                        </TableCell>
                                    </TableRow>
                                    {expanded ? (
                                        <TableRow key={`${o.id}-detail`}>
                                            <TableCell colSpan={6} className="bg-muted/30">
                                                <OrderDetail
                                                    order={o}
                                                    showActions={showActions}
                                                    denialComment={denialComment}
                                                    onDenialCommentChange={onDenialCommentChange}
                                                    pending={pending}
                                                    onAction={onAction}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ) : null}
                                </Fragment>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

function OrderDetail({
    order,
    showActions,
    denialComment,
    onDenialCommentChange,
    pending,
    onAction,
}: {
    order: AdminOrderRow;
    showActions: boolean;
    denialComment: string;
    onDenialCommentChange: (v: string) => void;
    pending: Action | null;
    onAction: (order: AdminOrderRow, action: Action) => void;
}) {
    const excelRow = formatOrderForExcel(order);

    return (
        <div className="space-y-4 py-2">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <Detail label="Vendor" value={order.vendor} />
                <Detail label="Quantity" value={String(order.quantity)} />
                <Detail label="Unit cost" value={formatPriceCents(order.unitCostCents)} />
                <Detail label="Total cost" value={formatPriceCents(totalCostCents(order))} />
                <Detail label="Part number" value={order.partNumber ?? "-"} />
                <div className="col-span-2">
                    <dt className="text-muted-foreground">Link</dt>
                    <dd>
                        <a
                            href={order.link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline-offset-4 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {order.link}
                        </a>
                    </dd>
                </div>
                {order.notes ? (
                    <div className="col-span-2">
                        <dt className="text-muted-foreground">Notes</dt>
                        <dd className="whitespace-pre-wrap">{order.notes}</dd>
                    </div>
                ) : null}
                {order.denialComment ? (
                    <div className="col-span-2">
                        <dt className="text-muted-foreground">Denial comment</dt>
                        <dd className="whitespace-pre-wrap">{order.denialComment}</dd>
                    </div>
                ) : null}
            </dl>

            {excelRow ? (
                <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            copyText(
                                excelRow,
                                order.fundType === "STF" ? "STF order" : "Gift order"
                            )
                        }
                    >
                        <Copy className="size-4" />
                        Copy for Excel
                    </Button>
                </div>
            ) : null}

            {showActions ? (
                <>
                    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                        <Label htmlFor={`denial-${order.id}`}>Denial comment (optional)</Label>
                        <Textarea
                            id={`denial-${order.id}`}
                            rows={3}
                            value={denialComment}
                            onChange={(e) => onDenialCommentChange(e.target.value)}
                            placeholder="Reason for denial, included in the email if provided."
                        />
                    </div>
                    <div
                        className="flex flex-wrap justify-end gap-2"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Button
                            variant="destructive"
                            onClick={() => onAction(order, "deny")}
                            disabled={pending !== null}
                        >
                            Deny
                        </Button>
                        <Button
                            onClick={() => onAction(order, "approve")}
                            disabled={pending !== null}
                        >
                            Approve
                        </Button>
                    </div>
                </>
            ) : null}
        </div>
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
