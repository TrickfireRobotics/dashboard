import { describe, it, expect } from "vitest";
import {
    stfOrderCalculations,
    formatStfOrderRow,
    formatGiftOrderRow,
    formatOrderForExcel,
    formatApprovedStfOrders,
    formatApprovedGiftOrders,
    STF_PRICE_FLUX,
    STF_TAX_RATE,
    STF_SHIPPING_RATE,
    type OrderExportRow,
} from "./order-export";

const BASE_STF: OrderExportRow = {
    itemName: "Motor Controller",
    fundType: "STF",
    stfBucketName: "Drivetrain",
    quantity: 2,
    unitCostCents: 5000, // $50.00
    vendor: "Amazon",
    link: "https://example.com/motor",
    notes: null,
    partNumber: "MT-001",
    createdAt: new Date("2024-06-15"),
    status: "approved",
};

const BASE_GIFT: OrderExportRow = {
    itemName: "Bolts",
    fundType: "Gift",
    stfBucketName: null,
    quantity: 10,
    unitCostCents: 299, // $2.99
    vendor: "Home Depot",
    link: "https://example.com/bolts",
    notes: "M4 x 20mm",
    partNumber: "HD-BOLT-M4",
    createdAt: new Date("2024-06-15"),
    status: "approved",
};

describe("stfOrderCalculations", () => {
    it("applies flux, tax, and shipping multipliers correctly", () => {
        // qty=2, unitCostCents=5000 → unitCost=$50
        const calc = stfOrderCalculations(2, 5000);
        expect(calc.unitCost).toBe(50);
        expect(calc.unitCostFlux).toBeCloseTo(50 * STF_PRICE_FLUX);
        expect(calc.preTaxTotal).toBeCloseTo(2 * 50 * STF_PRICE_FLUX);
        expect(calc.tax).toBeCloseTo(calc.preTaxTotal * STF_TAX_RATE);
        expect(calc.shipping).toBeCloseTo(calc.preTaxTotal * STF_SHIPPING_RATE);
        expect(calc.total).toBeCloseTo(calc.preTaxTotal + calc.tax + calc.shipping);
    });

    it("returns zero for all fields when quantity is 0", () => {
        const calc = stfOrderCalculations(0, 5000);
        expect(calc.preTaxTotal).toBe(0);
        expect(calc.tax).toBe(0);
        expect(calc.shipping).toBe(0);
        expect(calc.total).toBe(0);
    });

    it("returns zero for all fields when unit cost is 0", () => {
        const calc = stfOrderCalculations(5, 0);
        expect(calc.unitCost).toBe(0);
        expect(calc.total).toBe(0);
    });

    it("calculates total as preTaxTotal + tax + shipping", () => {
        const calc = stfOrderCalculations(3, 1000);
        expect(calc.total).toBeCloseTo(calc.preTaxTotal + calc.tax + calc.shipping, 10);
    });
});

describe("formatStfOrderRow", () => {
    it("produces a tab-separated row", () => {
        const row = formatStfOrderRow(BASE_STF);
        const cols = row.split("\t");
        expect(cols.length).toBeGreaterThan(1);
    });

    it("includes the vendor and item name", () => {
        const row = formatStfOrderRow(BASE_STF);
        expect(row).toContain("Amazon");
        expect(row).toContain("Motor Controller");
    });

    it("includes the bucket name", () => {
        const row = formatStfOrderRow(BASE_STF);
        expect(row).toContain("Drivetrain");
    });

    it("uses empty string when stfBucketName is null", () => {
        const row = formatStfOrderRow({ ...BASE_STF, stfBucketName: null });
        // First column should be empty, so row starts with a tab
        expect(row.startsWith("\t")).toBe(true);
    });

    it("prepends header row when includeHeader is true", () => {
        const output = formatStfOrderRow(BASE_STF, true);
        const [header] = output.split("\n");
        expect(header).toContain("Vendor");
        expect(header).toContain("TOTAL");
    });
});

describe("formatGiftOrderRow", () => {
    it("produces a tab-separated row", () => {
        const row = formatGiftOrderRow(BASE_GIFT);
        expect(row.split("\t").length).toBeGreaterThan(1);
    });

    it("includes the vendor, item name, and notes", () => {
        const row = formatGiftOrderRow(BASE_GIFT);
        expect(row).toContain("Home Depot");
        expect(row).toContain("Bolts");
        expect(row).toContain("M4 x 20mm");
    });

    it("uses empty string when notes is null", () => {
        const row = formatGiftOrderRow({ ...BASE_GIFT, notes: null });
        // The last column (notes) should be empty — row ends with a tab
        expect(row.endsWith("\t")).toBe(true);
    });

    it("prepends header row when includeHeader is true", () => {
        const output = formatGiftOrderRow(BASE_GIFT, true);
        const [header] = output.split("\n");
        expect(header).toContain("Vendor");
        expect(header).toContain("Item Name");
    });
});

describe("formatOrderForExcel", () => {
    it("returns null for non-approved orders", () => {
        expect(formatOrderForExcel({ ...BASE_STF, status: "pending" })).toBeNull();
        expect(formatOrderForExcel({ ...BASE_STF, status: "denied" })).toBeNull();
    });

    it("returns an STF row for an approved STF order", () => {
        const result = formatOrderForExcel(BASE_STF);
        expect(result).not.toBeNull();
        expect(result).toContain("Drivetrain");
    });

    it("returns a Gift row for an approved Gift order", () => {
        const result = formatOrderForExcel(BASE_GIFT);
        expect(result).not.toBeNull();
        expect(result).toContain("Home Depot");
    });
});

describe("formatApprovedStfOrders", () => {
    it("returns empty string when there are no approved STF orders", () => {
        expect(formatApprovedStfOrders([])).toBe("");
        expect(formatApprovedStfOrders([{ ...BASE_STF, status: "pending" }])).toBe("");
    });

    it("returns one row per approved STF order joined by newline", () => {
        const orders = [BASE_STF, { ...BASE_STF, itemName: "Wheel" }];
        const result = formatApprovedStfOrders(orders);
        expect(result.split("\n")).toHaveLength(2);
    });

    it("excludes Gift orders", () => {
        const result = formatApprovedStfOrders([BASE_GIFT]);
        expect(result).toBe("");
    });
});

describe("formatApprovedGiftOrders", () => {
    it("returns empty string when there are no approved Gift orders", () => {
        expect(formatApprovedGiftOrders([])).toBe("");
        expect(formatApprovedGiftOrders([{ ...BASE_GIFT, status: "denied" }])).toBe("");
    });

    it("returns one row per approved Gift order", () => {
        const orders = [BASE_GIFT, { ...BASE_GIFT, itemName: "Screws" }];
        const result = formatApprovedGiftOrders(orders);
        expect(result.split("\n")).toHaveLength(2);
    });

    it("excludes STF orders", () => {
        const result = formatApprovedGiftOrders([BASE_STF]);
        expect(result).toBe("");
    });
});
