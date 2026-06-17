import {
    formatApprovedGiftOrders,
    formatApprovedStfOrders,
    formatGiftOrderRow,
    formatOrderForExcel,
    formatStfOrderRow,
    GIFT_EXCEL_HEADERS,
    stfOrderCalculations,
    STF_EXCEL_HEADERS,
} from "../src/lib/finance/order-export";

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
}

function splitRow(row: string): string[] {
    return row.split("\t");
}

// --- STF single row matches spreadsheet layout ---
const stfOrder = {
    itemName: "(Bucket Item) Fasteners",
    fundType: "STF" as const,
    stfBucketName: "Mechanical",
    quantity: 1,
    unitCostCents: 80_000,
    vendor: "Multiple vendors",
    link: "https://example.com/fasteners",
    notes: "Screws, bolts, nuts, etc",
    partNumber: "91290A115",
    createdAt: new Date("2025-09-15"),
    status: "approved" as const,
};

const stfCells = splitRow(formatStfOrderRow(stfOrder));
assert(stfCells.length === STF_EXCEL_HEADERS.length, "STF row column count mismatch");
assert(stfCells[0] === "Mechanical", "Subteam should map to STF bucket");
assert(stfCells[1] === "Multiple vendors", "Vendor mismatch");
assert(stfCells[2] === "(Bucket Item) Fasteners", "Item name mismatch");
assert(stfCells[3] === "1", "Quantity mismatch");
assert(stfCells[4] === "$800.00", "Unit cost mismatch");
assert(stfCells[5] === "1.2", "Price flux should be 1.2");
assert(stfCells[6] === "$960.00", "Unit cost (flux) mismatch");
assert(stfCells[7] === "$960.00", "Pre-tax total mismatch");
assert(stfCells[8] === "$105.60", "Tax mismatch");
assert(stfCells[9] === "$192.00", "Shipping mismatch");
assert(stfCells[10] === "$1,257.60", "TOTAL mismatch");
assert(stfCells[11] === "https://example.com/fasteners", "Link mismatch");
assert(stfCells[12] === "Screws, bolts, nuts, etc", "Reason/notes mismatch");

const calc = stfOrderCalculations(1, 80_000);
assert(calc.total === 1257.6, "STF calculation total mismatch");

// --- Gift single row matches spreadsheet layout ---
const giftOrder = {
    itemName: "Pit tape",
    fundType: "Gift" as const,
    stfBucketName: null,
    quantity: 3,
    unitCostCents: 1_299,
    vendor: "Amazon",
    link: "https://example.com/tape",
    notes: "Pit organization",
    partNumber: "B08XYZ",
    createdAt: new Date("2025-10-01T14:30:00"),
    status: "approved" as const,
};

const giftCells = splitRow(formatGiftOrderRow(giftOrder));
assert(giftCells.length === GIFT_EXCEL_HEADERS.length, "Gift row column count mismatch");
assert(giftCells[0] === "10/1/2025", "Date requested mismatch");
assert(giftCells[1] === "Amazon", "Gift vendor mismatch");
assert(giftCells[2] === "https://example.com/tape", "Gift link mismatch");
assert(giftCells[3] === "Pit tape", "Gift item name mismatch");
assert(giftCells[4] === "B08XYZ", "Gift part number mismatch");
assert(giftCells[5] === "3", "Gift quantity mismatch");
assert(giftCells[6] === "Pit organization", "Gift notes mismatch");

// --- Bulk export includes headers once ---
const bulkStf = formatApprovedStfOrders([stfOrder, { ...stfOrder, itemName: "Bearings" }]);
const stfLines = bulkStf.split("\n");
assert(stfLines.length === 2, "Bulk STF should be 2 data rows only");
assert(stfLines[0].startsWith("Mechanical\t"), "First STF data row mismatch");
assert(stfLines[1].includes("Bearings"), "Second STF data row mismatch");

const bulkGift = formatApprovedGiftOrders([giftOrder]);
const giftLines = bulkGift.split("\n");
assert(giftLines.length === 1, "Bulk Gift should be 1 data row only");

// --- Pending/denied orders excluded ---
const pendingStf = formatOrderForExcel({ ...stfOrder, status: "pending" });
const deniedGift = formatOrderForExcel({ ...giftOrder, status: "denied" });
assert(pendingStf === null, "Pending orders should not export");
assert(deniedGift === null, "Denied orders should not export");

const approvedStf = formatOrderForExcel(stfOrder);
const approvedGift = formatOrderForExcel(giftOrder);
assert(
    approvedStf != null && !approvedStf.includes("Subteam"),
    "Single STF copy should be data row only"
);
assert(
    approvedGift != null && !approvedGift.includes("Date Requested"),
    "Single Gift copy should be data row only"
);

// --- Bulk export ignores non-approved ---
const mixed = formatApprovedStfOrders([
    stfOrder,
    { ...stfOrder, status: "pending" },
    { ...stfOrder, status: "denied" },
    { ...stfOrder, itemName: "Only approved" },
]);
assert(mixed.split("\n").length === 2, "Bulk STF should only include approved orders");

const mixedGift = formatApprovedGiftOrders([
    giftOrder,
    { ...giftOrder, status: "pending" },
    { ...giftOrder, fundType: "STF", stfBucketName: "Mechanical" },
]);
assert(mixedGift.split("\n").length === 1, "Bulk Gift should only include approved gift orders");

// --- TSV safety: tabs/newlines stripped from cell content ---
const messy = formatStfOrderRow({
    ...stfOrder,
    notes: "Line1\nLine2\twith tab",
    vendor: "Vendor\tName",
});
assert(!messy.includes("\n"), "STF row should not contain embedded newlines");
assert(messy.includes("Line1 Line2 with tab"), "Newlines should be flattened");
assert(messy.includes("Vendor Name"), "Tabs in content should be flattened");

console.log("STF sample row:");
console.log(formatStfOrderRow(stfOrder));
console.log("");
console.log("Gift sample row:");
console.log(formatGiftOrderRow(giftOrder));
console.log("");
console.log("All order export checks passed.");
