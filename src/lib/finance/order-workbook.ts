// Builds the actual .xlsx file that mirrors the Ordering_Sheet tab finance
// maintains on SharePoint, so officers can hand over an always-current file
// instead of hand-copying approved orders into it.

import * as XLSX from "xlsx";

import {
    bucketOrGiftLabel,
    ORDER_QUEUE_HEADERS,
    requestedByLabel,
    type OrderExportRow,
} from "@/lib/finance/order-export";
import { DEFAULT_ORDER_PRICING, type OrderPricingSettings } from "@/lib/finance/order-pricing";

const DATE_FORMAT = "m/d/yyyy";
const CURRENCY_FORMAT = "$#,##0.00";

// SheetJS converts a Date's local wall-clock time to a serial number; midnight
// UTC on the right day would still shift a day under non-UTC server clocks.
function localMidnight(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function setFormat(sheet: XLSX.WorkSheet, row: number, col: number, format: string) {
    const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
    if (cell) cell.z = format;
}

export function buildOrderingSheetWorkbook(
    orders: OrderExportRow[],
    settings: OrderPricingSettings = DEFAULT_ORDER_PRICING
): Buffer {
    const rows = orders
        .filter((o) => o.status === "approved" || o.status === "ordered")
        .filter((o) => o.fundType === "STF" || o.fundType === "Gift")
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const taxRate = settings.taxPercentBps / 10_000;
    const sheet = XLSX.utils.aoa_to_sheet([[...ORDER_QUEUE_HEADERS]]);

    rows.forEach((order, i) => {
        const r = i + 1;
        const unitCost = order.unitCostCents / 100;
        const totalCost = order.quantity * unitCost;
        const totalWithTax = totalCost * (1 + taxRate);

        XLSX.utils.sheet_add_aoa(
            sheet,
            [
                [
                    localMidnight(order.createdAt),
                    order.vendor,
                    order.link,
                    order.itemName,
                    order.partNumber ?? "",
                    order.quantity,
                    unitCost,
                    totalCost,
                    totalWithTax,
                    bucketOrGiftLabel(order),
                    order.notes ?? "",
                    requestedByLabel(order),
                    order.status === "ordered" ? "Ordered" : "New Request",
                ],
            ],
            { origin: { r, c: 0 } }
        );

        setFormat(sheet, r, 0, DATE_FORMAT);
        setFormat(sheet, r, 6, CURRENCY_FORMAT);
        setFormat(sheet, r, 7, CURRENCY_FORMAT);
        setFormat(sheet, r, 8, CURRENCY_FORMAT);
    });

    sheet["!cols"] = ORDER_QUEUE_HEADERS.map(() => ({ wch: 18 }));
    sheet["!ref"] = XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: rows.length, c: ORDER_QUEUE_HEADERS.length - 1 },
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Ordering_Sheet");
    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
