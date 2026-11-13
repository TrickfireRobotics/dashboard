import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";

import type { OrderExportRow } from "./order-export";
import { buildOrderingSheetWorkbook } from "./order-workbook";

const BASE: OrderExportRow = {
    itemName: "Motor Controller",
    fundType: "STF",
    stfBucketName: "Drivetrain",
    quantity: 2,
    unitCostCents: 5000, // $50.00
    vendor: "Amazon",
    link: "https://example.com/motor",
    notes: null,
    partNumber: "MT-001",
    createdAt: new Date("2024-06-15T12:00:00"),
    status: "approved",
    requesterName: "Jamie",
    requesterEmail: "jamie@example.com",
};

function readSheet(buffer: Buffer) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets["Ordering_Sheet"];
    return XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false });
}

describe("buildOrderingSheetWorkbook", () => {
    it("writes the Ordering_Sheet header row followed by one row per order", () => {
        const rows = readSheet(
            buildOrderingSheetWorkbook([BASE, { ...BASE, itemName: "Wheel", status: "ordered" }])
        );
        expect(rows).toHaveLength(3);
        expect(rows[0][3]).toBe("Item Name");
        expect(rows[1][3]).toBe("Motor Controller");
        expect(rows[2][3]).toBe("Wheel");
    });

    it("excludes pending and denied orders", () => {
        const rows = readSheet(
            buildOrderingSheetWorkbook([
                { ...BASE, status: "pending" },
                { ...BASE, status: "denied" },
            ])
        );
        expect(rows).toHaveLength(1);
    });

    it("preserves the requested date without a timezone off-by-one", () => {
        const rows = readSheet(buildOrderingSheetWorkbook([BASE]));
        expect(rows[1][0]).toBe("6/15/2024");
    });

    it("computes total cost and marks already-ordered rows", () => {
        const rows = readSheet(
            buildOrderingSheetWorkbook([{ ...BASE, status: "ordered" }], {
                taxPercentBps: 1000,
                shippingPercentBps: 0,
            })
        );
        expect(rows[1][7]).toBe("$100.00");
        expect(rows[1][12]).toBe("Ordered");
    });
});
