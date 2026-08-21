"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import type { FundType, OrderStatus } from "@/lib/db/schema";
import {
    orderChargeCents,
    displayPercentToBps,
    type OrderPricingSettings,
} from "@/lib/finance/order-pricing";
import { formatDate, formatPriceCents } from "@/lib/utils";

import { OrderStatusBadge } from "./OrderStatusBadge";

export type MemberOrderRow = {
    id: number;
    itemName: string;
    fundType: FundType | null;
    stfBucketName: string | null;
    quantity: number;
    unitCostCents: number;
    status: OrderStatus;
    denialComment: string | null;
    createdAt: Date;
};

type StatusFilter = "all" | OrderStatus;
type FundFilter = "all" | "unassigned" | FundType;
type SortKey = "newest" | "oldest" | "item-asc" | "item-desc" | "total-desc" | "total-asc";

function totalCostCents(
    row: { fundType: FundType | null; quantity: number; unitCostCents: number },
    pricing: OrderPricingSettings
) {
    return orderChargeCents(row.fundType, row.quantity, row.unitCostCents, pricing);
}

function canModifyOrder(status: OrderStatus) {
    return status === "pending" || status === "denied";
}

export function OrderTable({
    orders,
    orderPricing,
}: {
    orders: MemberOrderRow[];
    orderPricing: { taxPercent: number; shippingPercent: number };
}) {
    const router = useRouter();
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [fundFilter, setFundFilter] = useState<FundFilter>("all");
    const [sortKey, setSortKey] = useState<SortKey>("newest");
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const pricingSettings = useMemo<OrderPricingSettings>(
        () => ({
            taxPercentBps: displayPercentToBps(orderPricing.taxPercent),
            shippingPercentBps: displayPercentToBps(orderPricing.shippingPercent),
        }),
        [orderPricing.taxPercent, orderPricing.shippingPercent]
    );

    const filteredOrders = useMemo(() => {
        let rows = orders.filter((order) => {
            if (statusFilter !== "all" && order.status !== statusFilter) return false;
            if (fundFilter === "unassigned" && order.fundType != null) return false;
            if (
                fundFilter !== "all" &&
                fundFilter !== "unassigned" &&
                order.fundType !== fundFilter
            )
                return false;
            return true;
        });

        rows = [...rows].sort((a, b) => {
            switch (sortKey) {
                case "oldest":
                    return a.createdAt.getTime() - b.createdAt.getTime();
                case "item-asc":
                    return a.itemName.localeCompare(b.itemName);
                case "item-desc":
                    return b.itemName.localeCompare(a.itemName);
                case "total-desc":
                    return totalCostCents(b, pricingSettings) - totalCostCents(a, pricingSettings);
                case "total-asc":
                    return totalCostCents(a, pricingSettings) - totalCostCents(b, pricingSettings);
                case "newest":
                default:
                    return b.createdAt.getTime() - a.createdAt.getTime();
            }
        });

        return rows;
    }, [fundFilter, orders, pricingSettings, sortKey, statusFilter]);

    async function handleDelete(order: MemberOrderRow) {
        if (!confirm(`Delete your order for "${order.itemName}"? This cannot be undone.`)) return;

        setDeletingId(order.id);
        try {
            const res = await fetch(`/api/orders/${order.id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error ?? "Failed to delete order");
            }
            toast.success("Order deleted");
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
                You have not submitted any orders yet.
            </div>
        );
    }

    const statusFilterItems = {
        all: "All statuses",
        pending: "Pending",
        approved: "Approved",
        ordered: "Ordered",
        denied: "Denied",
    };

    const fundFilterItems = {
        all: "All funds",
        unassigned: "Unassigned",
        STF: "STF",
        Gift: "Gift",
    };

    const sortItems = {
        newest: "Newest first",
        oldest: "Oldest first",
        "item-asc": "Item A–Z",
        "item-desc": "Item Z–A",
        "total-desc": "Highest total",
        "total-asc": "Lowest total",
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Select
                    items={statusFilterItems}
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                >
                    <SelectTrigger className="w-full sm:w-44">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="ordered">Ordered</SelectItem>
                        <SelectItem value="denied">Denied</SelectItem>
                    </SelectContent>
                </Select>

                <Select
                    items={fundFilterItems}
                    value={fundFilter}
                    onValueChange={(value) => setFundFilter(value as FundFilter)}
                >
                    <SelectTrigger className="w-full sm:w-36">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All funds</SelectItem>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        <SelectItem value="STF">STF</SelectItem>
                        <SelectItem value="Gift">Gift</SelectItem>
                    </SelectContent>
                </Select>

                <Select
                    items={sortItems}
                    value={sortKey}
                    onValueChange={(value) => setSortKey(value as SortKey)}
                >
                    <SelectTrigger className="w-full sm:w-44">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="newest">Newest first</SelectItem>
                        <SelectItem value="oldest">Oldest first</SelectItem>
                        <SelectItem value="item-asc">Item A–Z</SelectItem>
                        <SelectItem value="item-desc">Item Z–A</SelectItem>
                        <SelectItem value="total-desc">Highest total</SelectItem>
                        <SelectItem value="total-asc">Lowest total</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {filteredOrders.length === 0 ? (
                <div className="border-border text-muted-foreground rounded-lg border p-10 text-center">
                    No orders match the current filters.
                </div>
            ) : (
                <div className="border-border rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Item</TableHead>
                                <TableHead className="hidden md:table-cell">
                                    Fund / bucket
                                </TableHead>
                                <TableHead className="hidden text-right md:table-cell">
                                    Total
                                </TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Submitted</TableHead>
                                <TableHead className="hidden md:table-cell">Officer note</TableHead>
                                <TableHead className="w-24 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredOrders.map((o) => (
                                <TableRow key={o.id}>
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
                                                Not yet assigned
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="hidden text-right whitespace-nowrap md:table-cell">
                                        {formatPriceCents(totalCostCents(o, pricingSettings))}
                                    </TableCell>
                                    <TableCell>
                                        <OrderStatusBadge status={o.status} />
                                    </TableCell>
                                    <TableCell className="text-muted-foreground whitespace-nowrap">
                                        {formatDate(o.createdAt)}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground hidden max-w-50 whitespace-normal md:table-cell">
                                        {o.denialComment ?? "-"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {canModifyOrder(o.status) ? (
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    nativeButton={false}
                                                    render={<Link href={`/orders/${o.id}/edit`} />}
                                                    aria-label={`Edit order for ${o.itemName}`}
                                                >
                                                    <Pencil className="size-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    onClick={() => handleDelete(o)}
                                                    disabled={deletingId === o.id}
                                                    aria-label={`Delete order for ${o.itemName}`}
                                                >
                                                    <Trash2 className="text-destructive size-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
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
