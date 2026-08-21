"use client";

import { Copy, PackageCheck, Trash2 } from "lucide-react";
import { Fragment, type ReactNode, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { isOverBudget, StfBucketSelectItemContent } from "@/components/BalanceAmount";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
import { cn, formatDate, formatPriceCents } from "@/lib/utils";

import { OrderStatusBadge } from "./OrderStatusBadge";

export type AdminOrderRow = {
    id: number;
    itemName: string;
    fundType: FundType | null;
    stfBucketId: number | null;
    stfBucketName: string | null;
    batchId: string | null;
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

export type StfBucketOption = {
    id: number;
    name: string;
    remainingBalanceCents: number;
};

type Action = "approve" | "deny";

export type OrderPricing = {
    taxPercent: number;
    shippingPercent: number;
};

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

function plural(count: number, noun: string) {
    return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function AdminOrderQueue({
    orders,
    stfBuckets,
    orderPricing,
}: {
    orders: AdminOrderRow[];
    stfBuckets: StfBucketOption[];
    orderPricing: OrderPricing;
}) {
    const router = useRouter();
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [denialComment, setDenialComment] = useState("");
    const [pending, setPending] = useState<Action | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [markingOrdered, setMarkingOrdered] = useState(false);
    const [busy, setBusy] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const pricingSettings = toPricingSettings(orderPricing);

    const { untriagedOrders, reviewOrders, approvedOrders, orderedOrders, deniedOrders } = useMemo(
        () => ({
            untriagedOrders: orders.filter((o) => o.status === "pending" && !o.fundType),
            reviewOrders: orders.filter((o) => o.status === "pending" && o.fundType),
            approvedOrders: orders.filter((o) => o.status === "approved"),
            orderedOrders: orders.filter((o) => o.status === "ordered"),
            deniedOrders: orders.filter((o) => o.status === "denied"),
        }),
        [orders]
    );

    const approvedStfCount = approvedOrders.filter((o) => o.fundType === "STF").length;
    const approvedGiftCount = approvedOrders.filter((o) => o.fundType === "Gift").length;

    function selectedIn(rows: AdminOrderRow[]): number[] {
        return rows.filter((o) => selectedIds.has(o.id)).map((o) => o.id);
    }

    function toggleSelection(orderId: number) {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(orderId)) next.delete(orderId);
            else next.add(orderId);
            return next;
        });
    }

    function toggleAllIn(rows: AdminOrderRow[]) {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            const allSelected = rows.every((o) => next.has(o.id));
            for (const row of rows) {
                if (allSelected) next.delete(row.id);
                else next.add(row.id);
            }
            return next;
        });
    }

    function makeSelection(rows: AdminOrderRow[]) {
        const selectedCount = rows.filter((o) => selectedIds.has(o.id)).length;
        return {
            selectedIds,
            onToggle: toggleSelection,
            onToggleAll: () => toggleAllIn(rows),
            allSelected: selectedCount === rows.length && rows.length > 0,
            someSelected: selectedCount > 0 && selectedCount < rows.length,
        };
    }

    async function post(url: string, body: unknown, failureMessage: string) {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => null);
            throw new Error(data?.error ?? failureMessage);
        }
        return res.json().catch(() => null);
    }

    async function runAction(order: AdminOrderRow, action: Action) {
        setPending(action);
        try {
            await post(
                `/api/orders/${order.id}/action`,
                {
                    action,
                    denialComment: action === "deny" ? denialComment || undefined : undefined,
                },
                "Action failed"
            );
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

    async function runBulkAction(orderIds: number[], action: Action, comment?: string) {
        if (orderIds.length === 0) return;
        if (action === "deny" && !confirm(`Deny ${plural(orderIds.length, "order")}?`)) return;

        setBusy(true);
        try {
            const data = await post(
                "/api/orders/bulk-action",
                { orderIds, action, denialComment: comment || undefined },
                "Bulk action failed"
            );
            toast.success(
                `${plural(data?.count ?? orderIds.length, "order")} ${action === "approve" ? "approved" : "denied"}`
            );
            setSelectedIds(new Set());
            setExpandedId(null);
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setBusy(false);
        }
    }

    async function assignOrders(orderIds: number[], fundType: FundType, bucketId: number | null) {
        if (orderIds.length === 0) return;
        setBusy(true);
        try {
            await post(
                "/api/orders/assign",
                { orderIds, fundType, stfBucketId: bucketId ?? undefined },
                "Failed to assign orders"
            );
            toast.success(`${plural(orderIds.length, "order")} assigned`);
            setSelectedIds(new Set());
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setBusy(false);
        }
    }

    async function markApprovedAsOrdered(orderIds?: number[]) {
        const count = orderIds?.length ?? approvedOrders.length;
        if (count === 0) return;

        const message = `Move ${plural(count, "approved order")} to the ordered archive? ${count === 1 ? "It" : "They"} will no longer appear in Excel exports.`;
        if (!confirm(message)) return;

        setMarkingOrdered(true);
        try {
            const data = await post(
                "/api/orders/mark-ordered",
                orderIds ? { orderIds } : {},
                "Failed to mark orders as ordered"
            );
            toast.success(`${plural(data?.movedCount ?? count, "order")} moved to ordered`);
            setExpandedId(null);
            setSelectedIds(new Set());
            router.refresh();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setMarkingOrdered(false);
        }
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

    const sharedSectionProps = {
        expandedId,
        onToggle: (id: number) => {
            setExpandedId((prev) => (prev === id ? null : id));
            setDenialComment("");
        },
        denialComment,
        onDenialCommentChange: setDenialComment,
        pending,
        onAction: runAction,
        orderPricing,
    };

    return (
        <div className="space-y-8">
            {approvedOrders.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={approvedStfCount === 0}
                        onClick={() =>
                            copyText(
                                formatApprovedStfOrders(orders, pricingSettings),
                                plural(approvedStfCount, "approved STF order")
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
                                plural(approvedGiftCount, "approved Gift order")
                            )
                        }
                    >
                        <Copy className="size-4" />
                        Copy all approved Gift ({approvedGiftCount})
                    </Button>
                    <Button
                        size="sm"
                        disabled={markingOrdered}
                        onClick={() => markApprovedAsOrdered()}
                    >
                        <PackageCheck className="size-4" />
                        Mark all approved as ordered ({approvedOrders.length})
                    </Button>
                </div>
            )}

            {untriagedOrders.length > 0 ? (
                <OrderSection
                    {...sharedSectionProps}
                    title="Needs triage"
                    description="New requests with no fund assigned. Select several and assign them in one go."
                    orders={untriagedOrders}
                    showActions={false}
                    selection={makeSelection(untriagedOrders)}
                    toolbar={
                        <TriageToolbar
                            stfBuckets={stfBuckets}
                            selectedCount={selectedIn(untriagedOrders).length}
                            busy={busy}
                            onAssign={(fundType, bucketId) =>
                                assignOrders(selectedIn(untriagedOrders), fundType, bucketId)
                            }
                            onDeny={(comment) =>
                                runBulkAction(selectedIn(untriagedOrders), "deny", comment)
                            }
                        />
                    }
                />
            ) : null}

            <OrderSection
                {...sharedSectionProps}
                title="Ready to review"
                description={
                    reviewOrders.length > 0
                        ? "Assigned to a fund and waiting on an approval decision."
                        : undefined
                }
                orders={reviewOrders}
                showActions
                selection={makeSelection(reviewOrders)}
                toolbar={
                    <ReviewToolbar
                        stfBuckets={stfBuckets}
                        selectedCount={selectedIn(reviewOrders).length}
                        busy={busy}
                        onApprove={() => runBulkAction(selectedIn(reviewOrders), "approve")}
                        onDeny={(comment) =>
                            runBulkAction(selectedIn(reviewOrders), "deny", comment)
                        }
                        onReassign={(fundType, bucketId) =>
                            assignOrders(selectedIn(reviewOrders), fundType, bucketId)
                        }
                    />
                }
            />

            {approvedOrders.length > 0 ? (
                <OrderSection
                    {...sharedSectionProps}
                    title="Approved"
                    description="Ready to copy for vendor ordering. Select parts and move to ordered once placed."
                    orders={approvedOrders}
                    showActions={false}
                    onDelete={deleteOrder}
                    deletingId={deletingId}
                    selection={makeSelection(approvedOrders)}
                    headerAction={
                        <Button
                            size="sm"
                            disabled={selectedIn(approvedOrders).length === 0 || markingOrdered}
                            onClick={() => markApprovedAsOrdered(selectedIn(approvedOrders))}
                        >
                            <PackageCheck className="size-4" />
                            Move selected to ordered ({selectedIn(approvedOrders).length})
                        </Button>
                    }
                />
            ) : null}

            {deniedOrders.length > 0 ? (
                <OrderSection
                    {...sharedSectionProps}
                    title="Denied"
                    orders={deniedOrders}
                    showActions={false}
                    onDelete={deleteOrder}
                    deletingId={deletingId}
                />
            ) : null}

            {orderedOrders.length > 0 ? (
                <OrderSection
                    {...sharedSectionProps}
                    title="Ordered"
                    description="Parts that have already been placed with vendors."
                    orders={orderedOrders}
                    showActions={false}
                    onDelete={deleteOrder}
                    deletingId={deletingId}
                />
            ) : null}
        </div>
    );
}

function BucketSelect({
    stfBuckets,
    value,
    onChange,
}: {
    stfBuckets: StfBucketOption[];
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <Select
            items={Object.fromEntries(stfBuckets.map((b) => [String(b.id), b.name]))}
            value={value}
            onValueChange={(v) => onChange(v ?? "")}
        >
            <SelectTrigger className="w-56">
                <SelectValue placeholder="Select bucket" />
            </SelectTrigger>
            <SelectContent>
                {stfBuckets.map((bucket) => (
                    <SelectItem
                        key={bucket.id}
                        value={String(bucket.id)}
                        className={cn(
                            isOverBudget(bucket.remainingBalanceCents) && "text-destructive"
                        )}
                    >
                        <StfBucketSelectItemContent
                            name={bucket.name}
                            cents={bucket.remainingBalanceCents}
                        />
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function FundAssignControls({
    stfBuckets,
    selectedCount,
    busy,
    onAssign,
    label,
}: {
    stfBuckets: StfBucketOption[];
    selectedCount: number;
    busy: boolean;
    onAssign: (fundType: FundType, bucketId: number | null) => void;
    label: string;
}) {
    const [fundType, setFundType] = useState<FundType | "">("");
    const [bucketId, setBucketId] = useState("");

    const ready = selectedCount > 0 && fundType !== "" && (fundType === "Gift" || bucketId !== "");

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Select
                items={{ STF: "STF", Gift: "Gift" }}
                value={fundType}
                onValueChange={(v) => {
                    setFundType((v as FundType | null) ?? "");
                    setBucketId("");
                }}
            >
                <SelectTrigger className="w-32">
                    <SelectValue placeholder="Fund" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="STF">STF</SelectItem>
                    <SelectItem value="Gift">Gift</SelectItem>
                </SelectContent>
            </Select>

            {fundType === "STF" ? (
                <BucketSelect stfBuckets={stfBuckets} value={bucketId} onChange={setBucketId} />
            ) : null}

            <Button
                size="sm"
                disabled={!ready || busy}
                onClick={() => onAssign(fundType as FundType, bucketId ? Number(bucketId) : null)}
            >
                {label} ({selectedCount})
            </Button>
        </div>
    );
}

function BulkDenyControl({
    selectedCount,
    busy,
    onDeny,
}: {
    selectedCount: number;
    busy: boolean;
    onDeny: (comment: string) => void;
}) {
    const [comment, setComment] = useState("");
    return (
        <div className="flex flex-wrap items-center gap-2">
            <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Denial reason (optional)"
                aria-label="Denial reason for selected orders"
                className="border-input bg-background h-9 w-56 rounded-md border px-3 text-sm"
            />
            <Button
                variant="destructive"
                size="sm"
                disabled={selectedCount === 0 || busy}
                onClick={() => onDeny(comment)}
            >
                Deny selected ({selectedCount})
            </Button>
        </div>
    );
}

function TriageToolbar({
    stfBuckets,
    selectedCount,
    busy,
    onAssign,
    onDeny,
}: {
    stfBuckets: StfBucketOption[];
    selectedCount: number;
    busy: boolean;
    onAssign: (fundType: FundType, bucketId: number | null) => void;
    onDeny: (comment: string) => void;
}) {
    return (
        <div className="bg-muted/40 border-border flex flex-wrap items-center gap-4 rounded-lg border px-4 py-3">
            <span className="text-sm font-medium">
                {selectedCount > 0 ? `${selectedCount} selected` : "Select orders to assign"}
            </span>
            <FundAssignControls
                stfBuckets={stfBuckets}
                selectedCount={selectedCount}
                busy={busy}
                onAssign={onAssign}
                label="Assign"
            />
            <BulkDenyControl selectedCount={selectedCount} busy={busy} onDeny={onDeny} />
        </div>
    );
}

function ReviewToolbar({
    stfBuckets,
    selectedCount,
    busy,
    onApprove,
    onDeny,
    onReassign,
}: {
    stfBuckets: StfBucketOption[];
    selectedCount: number;
    busy: boolean;
    onApprove: () => void;
    onDeny: (comment: string) => void;
    onReassign: (fundType: FundType, bucketId: number | null) => void;
}) {
    return (
        <div className="bg-muted/40 border-border flex flex-wrap items-center gap-4 rounded-lg border px-4 py-3">
            <span className="text-sm font-medium">
                {selectedCount > 0 ? `${selectedCount} selected` : "Select orders to review"}
            </span>
            <Button size="sm" disabled={selectedCount === 0 || busy} onClick={onApprove}>
                Approve selected ({selectedCount})
            </Button>
            <BulkDenyControl selectedCount={selectedCount} busy={busy} onDeny={onDeny} />
            <FundAssignControls
                stfBuckets={stfBuckets}
                selectedCount={selectedCount}
                busy={busy}
                onAssign={onReassign}
                label="Reassign"
            />
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
    toolbar,
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
    toolbar?: ReactNode;
}) {
    if (orders.length === 0) return null;

    const pricingSettings = toPricingSettings(orderPricing);
    const columnCount = selection ? 7 : 6;

    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold">
                        {title}{" "}
                        <span className="text-muted-foreground font-normal">({orders.length})</span>
                    </h2>
                    {description ? (
                        <p className="text-muted-foreground text-sm">{description}</p>
                    ) : null}
                </div>
                {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
            </div>
            {toolbar}
            <div className="border-border rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {selection ? (
                                <TableHead className="w-10">
                                    <input
                                        type="checkbox"
                                        aria-label={`Select all ${title.toLowerCase()} orders`}
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
                                            {o.fundType ? (
                                                <>
                                                    {o.fundType}
                                                    {o.stfBucketName ? ` · ${o.stfBucketName}` : ""}
                                                </>
                                            ) : (
                                                <span className="text-muted-foreground italic">
                                                    Unassigned
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="hidden text-right md:table-cell">
                                            {o.fundType ? null : (
                                                <span className="text-muted-foreground">est. </span>
                                            )}
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
                                        <TableRow>
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
                <Detail
                    label={order.fundType ? "Total cost" : "Estimated total"}
                    value={formatPriceCents(total)}
                />
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
