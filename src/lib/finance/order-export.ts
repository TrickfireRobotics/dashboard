import type { FundType, OrderStatus } from "@/lib/db/schema";
import {
    DEFAULT_ORDER_PRICING,
    STF_PRICE_FLUX,
    type OrderPricingSettings,
} from "@/lib/finance/order-pricing";

export { STF_PRICE_FLUX };

export type OrderExportRow = {
    itemName: string;
    fundType: FundType;
    stfBucketName: string | null;
    quantity: number;
    unitCostCents: number;
    vendor: string;
    link: string;
    notes: string | null;
    partNumber: string | null;
    createdAt: Date;
    status: OrderStatus;
};

export const STF_EXCEL_HEADERS = [
    "Subteam",
    "Vendor",
    "Parts to be ordered",
    "Qt",
    "Unit Cost",
    "Price Flux",
    "Unit Cost (Flux)",
    "Pre-Tax Total",
    "Tax",
    "Shipping",
    "TOTAL",
    "Link to item/quote",
    "Reason",
] as const;

export const GIFT_EXCEL_HEADERS = [
    "Date Requested",
    "Vendor",
    "Link",
    "Item Name",
    "Part #",
    "Quantity",
    "Notes",
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

export function stfOrderCalculations(
    quantity: number,
    unitCostCents: number,
    settings: OrderPricingSettings = DEFAULT_ORDER_PRICING
) {
    const unitCost = unitCostCents / 100;
    const unitCostFlux = unitCost * STF_PRICE_FLUX;
    const preTaxTotal = quantity * unitCostFlux;
    const taxRate = settings.taxPercentBps / 10_000;
    const shippingRate = settings.shippingPercentBps / 10_000;
    const tax = preTaxTotal * taxRate;
    const shipping = preTaxTotal * shippingRate;
    const total = preTaxTotal + tax + shipping;
    return { unitCost, unitCostFlux, preTaxTotal, tax, shipping, total };
}

export function formatStfOrderRow(
    order: OrderExportRow,
    includeHeader = false,
    settings: OrderPricingSettings = DEFAULT_ORDER_PRICING
): string {
    const { unitCost, unitCostFlux, preTaxTotal, tax, shipping, total } = stfOrderCalculations(
        order.quantity,
        order.unitCostCents,
        settings
    );

    const row = joinRow([
        order.stfBucketName ?? "",
        order.vendor,
        order.itemName,
        order.quantity,
        formatExcelCurrency(unitCost),
        STF_PRICE_FLUX,
        formatExcelCurrency(unitCostFlux),
        formatExcelCurrency(preTaxTotal),
        formatExcelCurrency(tax),
        formatExcelCurrency(shipping),
        formatExcelCurrency(total),
        order.link,
        order.notes ?? "",
    ]);

    if (!includeHeader) return row;
    return `${joinRow([...STF_EXCEL_HEADERS])}\n${row}`;
}

export function formatGiftOrderRow(order: OrderExportRow, includeHeader = false): string {
    const row = joinRow([
        formatExcelDate(order.createdAt),
        order.vendor,
        order.link,
        order.itemName,
        order.partNumber ?? "",
        order.quantity,
        order.notes ?? "",
    ]);

    if (!includeHeader) return row;
    return `${joinRow([...GIFT_EXCEL_HEADERS])}\n${row}`;
}

export function formatOrderForExcel(
    order: OrderExportRow,
    includeHeader = false,
    settings: OrderPricingSettings = DEFAULT_ORDER_PRICING
): string | null {
    if (order.status !== "approved") return null;
    if (order.fundType === "STF") return formatStfOrderRow(order, includeHeader, settings);
    if (order.fundType === "Gift") return formatGiftOrderRow(order, includeHeader);
    return null;
}

export function formatApprovedStfOrders(
    orders: OrderExportRow[],
    settings: OrderPricingSettings = DEFAULT_ORDER_PRICING
): string {
    const approved = orders.filter((o) => o.status === "approved" && o.fundType === "STF");
    if (approved.length === 0) return "";
    return approved.map((o) => formatStfOrderRow(o, false, settings)).join("\n");
}

export function formatApprovedGiftOrders(orders: OrderExportRow[]): string {
    const approved = orders.filter((o) => o.status === "approved" && o.fundType === "Gift");
    if (approved.length === 0) return "";
    return approved.map((o) => formatGiftOrderRow(o)).join("\n");
}
