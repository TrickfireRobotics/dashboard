"use client";

import { Fragment, useMemo, useState } from "react";

import { DataTableCard, DataTableCardToolbar } from "@/components/ui/data-table-card";
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

export type TeamOrderRow = {
    id: number;
    itemName: string;
    fundType: FundType | null;
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

type StatusFilter = "all" | OrderStatus;
type FundFilter = "all" | "unassigned" | FundType;
type SortKey = "newest" | "oldest" | "item-asc" | "item-desc" | "total-desc" | "total-asc";

function totalCostCents(
    row: { fundType: FundType | null; quantity: number; unitCostCents: number },
    pricing: OrderPricingSettings
) {
    return orderChargeCents(row.fundType, row.quantity, row.unitCostCents, pricing);
}

function requesterLabel(row: TeamOrderRow) {
    return row.requesterName ?? row.requesterEmail ?? "-";
}

export function TeamOrderTable({
    orders,
    orderPricing,
    emptyMessage,
}: {
    orders: TeamOrderRow[];
    orderPricing: { taxPercent: number; shippingPercent: number };
    emptyMessage?: string;
}) {
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [fundFilter, setFundFilter] = useState<FundFilter>("all");
    const [sortKey, setSortKey] = useState<SortKey>("newest");
    const [expandedId, setExpandedId] = useState<number | null>(null);
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

    if (orders.length === 0) {
        return (
            <div className="border-border text-muted-foreground rounded-lg border p-10 text-center">
                {emptyMessage ?? "No orders have been submitted yet."}
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
        <DataTableCard>
            <DataTableCardToolbar>
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
            </DataTableCardToolbar>

            {filteredOrders.length === 0 ? (
                <div className="text-muted-foreground p-10 text-center">
                    No orders match the current filters.
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Submitted by</TableHead>
                            <TableHead>Item</TableHead>
                            <TableHead className="hidden md:table-cell">Fund / bucket</TableHead>
                            <TableHead className="hidden text-right md:table-cell">Total</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="hidden md:table-cell">Submitted</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredOrders.map((o) => {
                            const expanded = expandedId === o.id;

                            return (
                                <Fragment key={o.id}>
                                    <TableRow
                                        className="cursor-pointer"
                                        onClick={() =>
                                            setExpandedId((current) =>
                                                current === o.id ? null : o.id
                                            )
                                        }
                                    >
                                        <TableCell className="text-muted-foreground">
                                            {requesterLabel(o)}
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
                                        <TableCell className="text-muted-foreground hidden whitespace-nowrap md:table-cell">
                                            {formatDate(o.createdAt)}
                                        </TableCell>
                                    </TableRow>
                                    {expanded ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="bg-muted/30">
                                                <OrderDetails
                                                    order={o}
                                                    pricingSettings={pricingSettings}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ) : null}
                                </Fragment>
                            );
                        })}
                    </TableBody>
                </Table>
            )}
        </DataTableCard>
    );
}

function OrderDetails({
    order,
    pricingSettings,
}: {
    order: TeamOrderRow;
    pricingSettings: OrderPricingSettings;
}) {
    return (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 py-2 text-sm">
            <Detail label="Vendor" value={order.vendor} />
            <Detail label="Quantity" value={String(order.quantity)} />
            <Detail label="Unit cost" value={formatPriceCents(order.unitCostCents)} />
            <Detail
                label="Total cost"
                value={formatPriceCents(totalCostCents(order, pricingSettings))}
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
                        onClick={(event) => event.stopPropagation()}
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
                    <dt className="text-muted-foreground">Officer note</dt>
                    <dd className="whitespace-pre-wrap">{order.denialComment}</dd>
                </div>
            ) : null}
        </dl>
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
