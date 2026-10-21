import { describe, it, expect } from "vitest";
import {
    formatOrderQueueRow,
    formatOrderForExcel,
    formatApprovedStfOrders,
    formatApprovedGiftOrders,
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
    requesterName: "Jamie",
    requesterEmail: "jamie@example.com",
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
    requesterName: null,
    requesterEmail: "sam@example.com",
};

describe("formatOrderQueueRow", () => {
    it("produces a tab-separated row matching the Ordering_Sheet column order", () => {
        const row = formatOrderQueueRow(BASE_STF);
        const cols = row.split("\t");
        // Date, Vendor, Link, Item Name, Part #, Quantity, Unit Cost, Total Cost,
        // Total w/tax, Bucket/Gift, Notes, Requested By, Select Drop Down
        expect(cols).toHaveLength(13);
        expect(cols[1]).toBe("Amazon");
        expect(cols[2]).toBe("https://example.com/motor");
        expect(cols[3]).toBe("Motor Controller");
        expect(cols[4]).toBe("MT-001");
        expect(cols[5]).toBe("2");
    });

    it("prefixes the STF bucket name with '(Bucket Item)'", () => {
        const row = formatOrderQueueRow(BASE_STF);
        expect(row.split("\t")[9]).toBe("(Bucket Item) Drivetrain");
    });

    it("uses 'Gift' for the Bucket/Gift column on Gift-fund orders", () => {
        const row = formatOrderQueueRow(BASE_GIFT);
        expect(row.split("\t")[9]).toBe("Gift");
    });

    it("falls back to requester email when the name is missing", () => {
        const row = formatOrderQueueRow(BASE_GIFT);
        expect(row.split("\t")[11]).toBe("sam@example.com");
    });

    it("computes Total Cost and Total w/tax from quantity and unit cost, with no flux or shipping", () => {
        const row = formatOrderQueueRow(BASE_STF, false, {
            taxPercentBps: 1200,
            shippingPercentBps: 2000,
        });
        const cols = row.split("\t");
        expect(cols[7]).toBe("$100.00"); // 2 * $50, no flux
        expect(cols[8]).toBe("$112.00"); // +12% tax, no shipping
    });

    it("sets the Select Drop Down column to 'New Request'", () => {
        const row = formatOrderQueueRow(BASE_STF);
        expect(row.split("\t")[12]).toBe("New Request");
    });

    it("prepends the Ordering_Sheet header row when includeHeader is true", () => {
        const output = formatOrderQueueRow(BASE_STF, true);
        const [header] = output.split("\n");
        expect(header).toBe(
            "Date Requested\tVendor\tLink\tItem Name\tPart #\tQuantity\tUnit Cost\tTotal Cost\tTotal w/tax\tBucket/Gift\tNotes\tRequested By\tSelect Drop Down"
        );
    });
});

describe("formatOrderForExcel", () => {
    it("returns null for non-approved orders", () => {
        expect(formatOrderForExcel({ ...BASE_STF, status: "pending" })).toBeNull();
        expect(formatOrderForExcel({ ...BASE_STF, status: "denied" })).toBeNull();
        expect(formatOrderForExcel({ ...BASE_STF, status: "ordered" })).toBeNull();
    });

    it("returns a row for an approved STF order", () => {
        const result = formatOrderForExcel(BASE_STF);
        expect(result).not.toBeNull();
        expect(result).toContain("Drivetrain");
    });

    it("returns a row for an approved Gift order", () => {
        const result = formatOrderForExcel(BASE_GIFT);
        expect(result).not.toBeNull();
        expect(result).toContain("Home Depot");
    });
});

describe("formatApprovedStfOrders", () => {
    it("returns empty string when there are no approved STF orders", () => {
        expect(formatApprovedStfOrders([])).toBe("");
        expect(formatApprovedStfOrders([{ ...BASE_STF, status: "pending" }])).toBe("");
        expect(formatApprovedStfOrders([{ ...BASE_STF, status: "ordered" }])).toBe("");
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
        expect(formatApprovedGiftOrders([{ ...BASE_GIFT, status: "ordered" }])).toBe("");
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
