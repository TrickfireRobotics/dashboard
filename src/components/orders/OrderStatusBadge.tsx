"use client";

import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/lib/db/schema";

const STATUS: Record<
  OrderStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  pending: { label: "Pending", variant: "outline" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
  ordered: { label: "Ordered", variant: "secondary" },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { label, variant } = STATUS[status];
  return <Badge variant={variant}>{label}</Badge>;
}
