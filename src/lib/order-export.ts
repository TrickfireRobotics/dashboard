import type { FundType, OrderStatus } from "@/lib/db/schema";

export const STF_PRICE_FLUX = 1.2;
export const STF_TAX_RATE = 0.11;
export const STF_SHIPPING_RATE = 0.2;

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

export function stfOrderCalculations(quantity: number, unitCostCents: number) {
    const unitCost = unitCostCents / 100;
    const unitCostFlux = unitCost * STF_PRICE_FLUX;
    const preTaxTotal = quantity * unitCostFlux;
    const tax = preTaxTotal * STF_TAX_RATE;
    const shipping = preTaxTotal * STF_SHIPPING_RATE;
    const total = preTaxTotal + tax + shipping;
    return { unitCost, unitCostFlux, preTaxTotal, tax, shipping, total };
}

export function formatStfOrderRow(order: OrderExportRow, includeHeader = false): string {
    const { unitCost, unitCostFlux, preTaxTotal, tax, shipping, total } = stfOrderCalculations(
        order.quantity,
        order.unitCostCents
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

export function formatOrderForExcel(order: OrderExportRow, includeHeader = false): string | null {
    if (order.status !== "approved") return null;
    if (order.fundType === "STF") return formatStfOrderRow(order, includeHeader);
    if (order.fundType === "Gift") return formatGiftOrderRow(order, includeHeader);
    return null;
}

export function formatApprovedStfOrders(orders: OrderExportRow[]): string {
    const approved = orders.filter((o) => o.status === "approved" && o.fundType === "STF");
    if (approved.length === 0) return "";
    return approved.map((o) => formatStfOrderRow(o)).join("\n");
}

export function formatApprovedGiftOrders(orders: OrderExportRow[]): string {
    const approved = orders.filter((o) => o.status === "approved" && o.fundType === "Gift");
    if (approved.length === 0) return "";
    return approved.map((o) => formatGiftOrderRow(o)).join("\n");
}
