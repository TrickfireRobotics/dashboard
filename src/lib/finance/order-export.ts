import type { FundType, OrderStatus } from "@/lib/db/schema";
import { DEFAULT_ORDER_PRICING, type OrderPricingSettings } from "@/lib/finance/order-pricing";

export type OrderExportRow = {
    itemName: string;
    fundType: FundType | null;
    stfBucketName: string | null;
    quantity: number;
    unitCostCents: number;
    vendor: string;
    link: string;
    notes: string | null;
    partNumber: string | null;
    createdAt: Date;
    status: OrderStatus;
    requesterName: string | null;
    requesterEmail: string | null;
};

// Matches the "TrickFire's Responsibility" columns (A:M) of the Ordering_Sheet
// tab, so a paste lands in the right columns and picks up the sheet's own
// conditional-formatting row color.
export const ORDER_QUEUE_HEADERS = [
    "Date Requested",
    "Vendor",
    "Link",
    "Item Name",
    "Part #",
    "Quantity",
    "Unit Cost",
    "Total Cost",
    "Total w/tax",
    "Bucket/Gift",
    "Notes",
    "Requested By",
    "Select Drop Down",
] as const;

function formatExcelCurrency(dollars: number): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
    }).format(dollars);
}

function formatExcelDate(date: Date): string {
    return new Intl.DateTimeFormat("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
    }).format(date);
}

function escapeTsvCell(value: string): string {
    return value.replace(/\t/g, " ").replace(/\r?\n/g, " ");
}

function joinRow(cells: (string | number)[]): string {
    return cells.map((cell) => escapeTsvCell(String(cell))).join("\t");
}

function bucketOrGiftLabel(order: OrderExportRow): string {
    if (order.fundType === "STF")
        return order.stfBucketName ? `(Bucket Item) ${order.stfBucketName}` : "";
    if (order.fundType === "Gift") return "Gift";
    return "";
}

function requestedByLabel(order: OrderExportRow): string {
    return order.requesterName ?? order.requesterEmail ?? "";
}

export function formatOrderQueueRow(
    order: OrderExportRow,
    includeHeader = false,
    settings: OrderPricingSettings = DEFAULT_ORDER_PRICING
): string {
    const unitCost = order.unitCostCents / 100;
    const totalCost = order.quantity * unitCost;
    const taxRate = settings.taxPercentBps / 10_000;
    const totalWithTax = totalCost * (1 + taxRate);

    const row = joinRow([
        formatExcelDate(order.createdAt),
        order.vendor,
        order.link,
        order.itemName,
        order.partNumber ?? "",
        order.quantity,
        formatExcelCurrency(unitCost),
        formatExcelCurrency(totalCost),
        formatExcelCurrency(totalWithTax),
        bucketOrGiftLabel(order),
        order.notes ?? "",
        requestedByLabel(order),
        "New Request",
    ]);

    if (!includeHeader) return row;
    return `${joinRow([...ORDER_QUEUE_HEADERS])}\n${row}`;
}

export function formatOrderForExcel(
    order: OrderExportRow,
    includeHeader = false,
    settings: OrderPricingSettings = DEFAULT_ORDER_PRICING
): string | null {
    if (order.status !== "approved") return null;
    if (order.fundType !== "STF" && order.fundType !== "Gift") return null;
    return formatOrderQueueRow(order, includeHeader, settings);
}

export function formatApprovedStfOrders(
    orders: OrderExportRow[],
    settings: OrderPricingSettings = DEFAULT_ORDER_PRICING
): string {
    const approved = orders.filter((o) => o.status === "approved" && o.fundType === "STF");
    if (approved.length === 0) return "";
    return approved.map((o) => formatOrderQueueRow(o, false, settings)).join("\n");
}

export function formatApprovedGiftOrders(
    orders: OrderExportRow[],
    settings: OrderPricingSettings = DEFAULT_ORDER_PRICING
): string {
    const approved = orders.filter((o) => o.status === "approved" && o.fundType === "Gift");
    if (approved.length === 0) return "";
    return approved.map((o) => formatOrderQueueRow(o, false, settings)).join("\n");
}
