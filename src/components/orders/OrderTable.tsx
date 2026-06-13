"use client";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import type { OrderStatus } from "@/lib/db/schema";
import { formatDate, formatPriceCents } from "@/lib/utils";

import { OrderStatusBadge } from "./OrderStatusBadge";

export type MemberOrderRow = {
    id: number;
    itemName: string;
    teamName: string | null;
    quantity: number;
    unitPrice: number | null;
    status: OrderStatus;
    adminNote: string | null;
    createdAt: Date;
};

export function OrderTable({ orders }: { orders: MemberOrderRow[] }) {
    if (orders.length === 0) {
        return (
            <div className="border-border text-muted-foreground rounded-lg border p-10 text-center">
                You have not submitted any orders yet.
            </div>
        );
    }

    return (
        <div className="border-border rounded-lg border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="hidden md:table-cell">Team</TableHead>
                        <TableHead className="hidden text-right md:table-cell">Qty</TableHead>
                        <TableHead className="hidden text-right md:table-cell">
                            Unit price
                        </TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead className="hidden md:table-cell">Admin note</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {orders.map((o) => (
                        <TableRow key={o.id}>
                            <TableCell className="text-foreground font-medium">
                                {o.itemName}
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
                            <TableCell className="text-muted-foreground">
                                {formatDate(o.createdAt)}
                            </TableCell>
                            <TableCell className="text-muted-foreground hidden max-w-50 whitespace-normal md:table-cell">
                                {o.adminNote ?? "-"}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
