"use client";

import { Copy, PackageCheck, Trash2 } from "lucide-react";
import { Fragment, type ReactNode } from "react";
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
import {
    orderChargeCents,
    displayPercentToBps,
    type OrderPricingSettings,
} from "@/lib/finance/order-pricing";
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

function toPricingSettings(orderPricing: OrderPricing): OrderPricingSettings {
    return {
        taxPercentBps: displayPercentToBps(orderPricing.taxPercent),
        shippingPercentBps: displayPercentToBps(orderPricing.shippingPercent),
    };
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

export type OrderPricing = {
    taxPercent: number;
    shippingPercent: number;
};

export function AdminOrderQueue({
    orders,
    orderPricing,
}: {
    orders: AdminOrderRow[];
    orderPricing: OrderPricing;
}) {
    const router = useRouter();
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [denialComment, setDenialComment] = useState("");
    const [pending, setPending] = useState<Action | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [markingOrdered, setMarkingOrdered] = useState(false);
    const [selectedApprovedIds, setSelectedApprovedIds] = useState<Set<number>>(new Set());
    const pricingSettings = toPricingSettings(orderPricing);

    const pendingOrders = orders.filter((o) => o.status === "pending");
    const approvedOrders = orders.filter((o) => o.status === "approved");
    const orderedOrders = orders.filter((o) => o.status === "ordered");
    const deniedOrders = orders.filter((o) => o.status === "denied");
    const approvedStfCount = approvedOrders.filter((o) => o.fundType === "STF").length;
    const approvedGiftCount = approvedOrders.filter((o) => o.fundType === "Gift").length;

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

    async function markApprovedAsOrdered(orderIds?: number[]) {
        const count = orderIds?.length ?? approvedOrders.length;
        if (count === 0) return;

        const message =
            count === 1
                ? "Move 1 approved order to the ordered archive? It will no longer appear in Excel exports."
                : `Move ${count} approved order${count === 1 ? "" : "s"} to the ordered archive? They will no longer appear in Excel exports.`;
        if (!confirm(message)) return;

        setMarkingOrdered(true);
        try {
            const res = await fetch("/api/orders/mark-ordered", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(orderIds ? { orderIds } : {}),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Failed to mark orders as ordered");
            }
            const data = await res.json();
            toast.success(
                data.movedCount === 1
                    ? "1 order moved to ordered"
                    : `${data.movedCount} orders moved to ordered`
            );
            setExpandedId(null);
            setSelectedApprovedIds(new Set());
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setMarkingOrdered(false);
        }
    }

    function toggleApprovedSelection(orderId: number) {
        setSelectedApprovedIds((prev) => {
            const next = new Set(prev);
            if (next.has(orderId)) next.delete(orderId);
            else next.add(orderId);
            return next;
        });
    }

    function toggleAllApprovedSelection() {
        setSelectedApprovedIds((prev) => {
            if (prev.size === approvedOrders.length) return new Set();
            return new Set(approvedOrders.map((o) => o.id));
        });
    }

    async function deleteOrder(order: AdminOrderRow) {
        const message =
            order.status === "approved" || order.status === "ordered"
                ? `Delete ${order.status} order for "${order.itemName}"? This removes it from the archive and restores any gift fund deduction.`
                : `Delete order for "${order.itemName}"? This cannot be undone.`;
        if (!confirm(message)) return;

        setDeletingId(order.id);
        try {
            const res = await fetch(`/api/orders/${order.id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Failed to delete order");
            }
            toast.success("Order deleted");
            setExpandedId(null);
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setDeletingId(null);
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
            {(approvedStfCount > 0 || approvedGiftCount > 0 || approvedOrders.length > 0) && (
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={approvedStfCount === 0}
                        onClick={() =>
                            copyText(
                                formatApprovedStfOrders(orders, pricingSettings),
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
                    <Button
                        size="sm"
                        disabled={approvedOrders.length === 0 || markingOrdered}
                        onClick={() => markApprovedAsOrdered()}
                    >
                        <PackageCheck className="size-4" />
                        Mark all approved as ordered ({approvedOrders.length})
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
                orderPricing={orderPricing}
            />
            {approvedOrders.length > 0 ? (
                <OrderSection
                    title="Approved"
                    description="Ready to copy for vendor ordering. Select parts and move to ordered once placed."
                    orders={approvedOrders}
                    expandedId={expandedId}
                    onToggle={(id) => setExpandedId((prev) => (prev === id ? null : id))}
                    denialComment={denialComment}
                    onDenialCommentChange={setDenialComment}
                    pending={pending}
                    onAction={runAction}
                    showActions={false}
                    orderPricing={orderPricing}
                    onDelete={deleteOrder}
                    deletingId={deletingId}
                    selection={{
                        selectedIds: selectedApprovedIds,
                        onToggle: toggleApprovedSelection,
                        onToggleAll: toggleAllApprovedSelection,
                        allSelected:
                            selectedApprovedIds.size === approvedOrders.length &&
                            approvedOrders.length > 0,
                        someSelected:
                            selectedApprovedIds.size > 0 &&
                            selectedApprovedIds.size < approvedOrders.length,
                    }}
                    headerAction={
                        <Button
                            size="sm"
                            disabled={selectedApprovedIds.size === 0 || markingOrdered}
                            onClick={() => markApprovedAsOrdered(Array.from(selectedApprovedIds))}
                        >
                            <PackageCheck className="size-4" />
                            Move selected to ordered ({selectedApprovedIds.size})
                        </Button>
                    }
                />
            ) : null}
            {deniedOrders.length > 0 ? (
                <OrderSection
                    title="Denied"
                    orders={deniedOrders}
                    expandedId={expandedId}
                    onToggle={(id) => setExpandedId((prev) => (prev === id ? null : id))}
                    denialComment={denialComment}
                    onDenialCommentChange={setDenialComment}
                    pending={pending}
                    onAction={runAction}
                    showActions={false}
                    orderPricing={orderPricing}
                    onDelete={deleteOrder}
                    deletingId={deletingId}
                />
            ) : null}
            {orderedOrders.length > 0 ? (
                <OrderSection
                    title="Ordered"
                    description="Parts that have already been placed with vendors."
                    orders={orderedOrders}
                    expandedId={expandedId}
                    onToggle={(id) => setExpandedId((prev) => (prev === id ? null : id))}
                    denialComment={denialComment}
                    onDenialCommentChange={setDenialComment}
                    pending={pending}
                    onAction={runAction}
                    showActions={false}
                    orderPricing={orderPricing}
                    onDelete={deleteOrder}
                    deletingId={deletingId}
                />
            ) : null}
        </div>
    );
}

function OrderSection({
    title,
    description,
    orders,
    expandedId,
    onToggle,
    denialComment,
    onDenialCommentChange,
    pending,
    onAction,
    showActions,
    orderPricing,
    onDelete,
    deletingId,
    selection,
    headerAction,
}: {
    title: string;
    description?: string;
    orders: AdminOrderRow[];
    expandedId: number | null;
    onToggle: (id: number) => void;
    denialComment: string;
    onDenialCommentChange: (v: string) => void;
    pending: Action | null;
    onAction: (order: AdminOrderRow, action: Action) => void;
    showActions: boolean;
    orderPricing: OrderPricing;
    onDelete?: (order: AdminOrderRow) => void;
    deletingId?: number | null;
    selection?: {
        selectedIds: Set<number>;
        onToggle: (id: number) => void;
        onToggleAll: () => void;
        allSelected: boolean;
        someSelected: boolean;
    };
    headerAction?: ReactNode;
}) {
    if (orders.length === 0) return null;

    const pricingSettings = toPricingSettings(orderPricing);
    const columnCount = selection ? 7 : 6;

    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold">{title}</h2>
                    {description ? (
                        <p className="text-muted-foreground text-sm">{description}</p>
                    ) : null}
                </div>
                {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
            </div>
            <div className="border-border rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {selection ? (
                                <TableHead className="w-10">
                                    <input
                                        type="checkbox"
                                        aria-label="Select all approved orders"
                                        checked={selection.allSelected}
                                        ref={(el) => {
                                            if (el) el.indeterminate = selection.someSelected;
                                        }}
                                        onChange={selection.onToggleAll}
                                        className="border-input size-4 rounded border"
                                    />
                                </TableHead>
                            ) : null}
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
                                        {selection ? (
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    aria-label={`Select order for ${o.itemName}`}
                                                    checked={selection.selectedIds.has(o.id)}
                                                    onChange={() => selection.onToggle(o.id)}
                                                    className="border-input size-4 rounded border"
                                                />
                                            </TableCell>
                                        ) : null}
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
                                            {formatPriceCents(
                                                orderChargeCents(
                                                    o.fundType,
                                                    o.quantity,
                                                    o.unitCostCents,
                                                    pricingSettings
                                                )
                                            )}
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
                                            <TableCell
                                                colSpan={columnCount}
                                                className="bg-muted/30"
                                            >
                                                <OrderDetail
                                                    order={o}
                                                    showActions={showActions}
                                                    denialComment={denialComment}
                                                    onDenialCommentChange={onDenialCommentChange}
                                                    pending={pending}
                                                    onAction={onAction}
                                                    orderPricing={orderPricing}
                                                    onDelete={onDelete}
                                                    deletingId={deletingId}
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
    orderPricing,
    onDelete,
    deletingId,
}: {
    order: AdminOrderRow;
    showActions: boolean;
    denialComment: string;
    onDenialCommentChange: (v: string) => void;
    pending: Action | null;
    onAction: (order: AdminOrderRow, action: Action) => void;
    orderPricing: OrderPricing;
    onDelete?: (order: AdminOrderRow) => void;
    deletingId?: number | null;
}) {
    const pricingSettings = toPricingSettings(orderPricing);
    const excelRow = formatOrderForExcel(order, false, pricingSettings);
    const total = orderChargeCents(
        order.fundType,
        order.quantity,
        order.unitCostCents,
        pricingSettings
    );

    return (
        <div className="space-y-4 py-2">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <Detail label="Vendor" value={order.vendor} />
                <Detail label="Quantity" value={String(order.quantity)} />
                <Detail label="Unit cost" value={formatPriceCents(order.unitCostCents)} />
                <Detail label="Total cost" value={formatPriceCents(total)} />
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
            ) : onDelete ? (
                <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onDelete(order)}
                        disabled={deletingId === order.id}
                    >
                        <Trash2 className="size-4" />
                        Delete order
                    </Button>
                </div>
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
