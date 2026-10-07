import * as XLSX from "xlsx";
import { beforeEach, describe, expect, it } from "vitest";

import { db, sqlite } from "@/lib/db";
import { approvedVendor, vendorImport } from "@/lib/db/schema";
import {
    applyVendorImport,
    diffVendors,
    getCurrentVendors,
    getLatestImport,
    parseVendorWorkbook,
    VendorImportConflictError,
    VendorImportError,
    type VendorRecord,
} from "./import";
import { searchVendors } from "./lookup";

const HEADER = [
    "Supplier",
    "Supplier Name",
    "Supplier ID",
    "Supplier Status",
    "Supplier Category",
    "Supplier Group",
    "Unique Entity Identifier",
    "Alternate Name",
    "Is Primary",
    "Use For",
    "Email Address",
    "Comments",
    "Contact",
];

// [name, id, status, category, email]
type Row = [string, string, string, string?, string?];

function workbook(rows: Row[], header = HEADER): Uint8Array {
    const aoa = [
        header,
        ...rows.map(([name, id, status, category = "", email = ""]) => [
            name,
            name,
            id,
            status,
            category,
            "",
            "",
            "",
            "",
            "",
            email,
            "",
            "",
        ]),
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Sheet1");
    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

function vendor(overrides: Partial<VendorRecord> & { supplierName: string }): VendorRecord {
    return {
        supplierId: null,
        status: "Active",
        category: null,
        group: null,
        uei: null,
        email: null,
        contact: null,
        remitAddress: null,
        useFor: null,
        ...overrides,
    };
}

const meta = { fileName: "vendors.xlsx", fileHash: "hash", importedBy: null };

describe("parseVendorWorkbook", () => {
    it("parses rows and collapses duplicates to the most-approved status", () => {
        const records = parseVendorWorkbook(
            workbook([
                ["Digi-Key", "S-1", "Inactive", "Electronics", ""],
                ["Digi-Key", "S-1", "Active", "", "sales@digikey.com"],
                ["McMaster-Carr", "S-2", "hold"],
                ["Blank Co", "S-3", ""],
            ])
        );

        expect(records).toHaveLength(3);
        const digikey = records.find((r) => r.supplierName === "Digi-Key");
        expect(digikey).toMatchObject({
            status: "Active",
            category: "Electronics",
            email: "sales@digikey.com",
        });
        expect(records.find((r) => r.supplierName === "McMaster-Carr")?.status).toBe("Hold");
        expect(records.find((r) => r.supplierName === "Blank Co")?.status).toBe("Unknown");
    });

    it("finds columns by header text, not position", () => {
        const header = ["Supplier Status", "Supplier Name", "Supplier ID"];
        const aoa = [header, ["Active", "Reordered Inc", "S-9"]];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Sheet1");
        const records = parseVendorWorkbook(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
        expect(records).toEqual([
            vendor({ supplierName: "Reordered Inc", supplierId: "S-9", status: "Active" }),
        ]);
    });

    it("rejects a spreadsheet that isn't the supplier export", () => {
        expect(() => parseVendorWorkbook(workbook([], ["Name", "Price"]))).toThrow(
            VendorImportError
        );
    });

    it("rejects an export with no vendor rows", () => {
        expect(() => parseVendorWorkbook(workbook([]))).toThrow(/no vendor rows/);
    });

    it("rejects a file that isn't a spreadsheet", () => {
        expect(() => parseVendorWorkbook(new TextEncoder().encode("\u0000\u0001junk"))).toThrow(
            VendorImportError
        );
    });
});

describe("diffVendors", () => {
    it("buckets vendors into added, removed, changed, and unchanged", () => {
        const current = [
            vendor({ supplierName: "Keep" }),
            vendor({ supplierName: "Gone" }),
            vendor({ supplierName: "Edit", status: "Active", email: "a@x.com" }),
        ];
        const incoming = [
            vendor({ supplierName: "Keep" }),
            vendor({ supplierName: "Edit", status: "Hold", email: "b@x.com" }),
            vendor({ supplierName: "New" }),
        ];

        const diff = diffVendors(current, incoming);

        expect(diff.added.map((v) => v.supplierName)).toEqual(["New"]);
        expect(diff.removed.map((v) => v.supplierName)).toEqual(["Gone"]);
        expect(diff.changed).toHaveLength(1);
        expect(diff.changed[0].fields).toEqual(["status", "email"]);
        expect(diff.changed[0].before.status).toBe("Active");
        expect(diff.changed[0].after.status).toBe("Hold");
        expect(diff.unchangedCount).toBe(1);
    });
});

describe("applyVendorImport", () => {
    beforeEach(() => {
        db.delete(approvedVendor).run();
        db.delete(vendorImport).run();
        sqlite.exec("DROP TABLE IF EXISTS approved_vendors_fts");
    });

    it("applies the diff, keeps ids of untouched rows, rebuilds search, and logs", () => {
        applyVendorImport(
            [
                vendor({ supplierName: "Keep Corp" }),
                vendor({ supplierName: "Gone Corp" }),
                vendor({ supplierName: "Edit Corp", status: "Active" }),
            ],
            meta
        );
        const keepId = db
            .select()
            .from(approvedVendor)
            .all()
            .find((v) => v.supplierName === "Keep Corp")!.id;

        const { diff, importInfo } = applyVendorImport(
            [
                vendor({ supplierName: "Keep Corp" }),
                vendor({ supplierName: "Edit Corp", status: "Hold" }),
                vendor({ supplierName: "Fresh Corp" }),
            ],
            meta
        );

        expect(diff.added).toHaveLength(1);
        expect(diff.removed).toHaveLength(1);
        expect(diff.changed).toHaveLength(1);

        const rows = db.select().from(approvedVendor).all();
        expect(rows.map((r) => r.supplierName).sort()).toEqual([
            "Edit Corp",
            "Fresh Corp",
            "Keep Corp",
        ]);
        expect(rows.find((r) => r.supplierName === "Keep Corp")!.id).toBe(keepId);
        const edited = rows.find((r) => r.supplierName === "Edit Corp")!;
        expect(edited.status).toBe("Hold");
        expect(edited.approved).toBe(false);

        expect(searchVendors("fresh").map((h) => h.supplierName)).toEqual(["Fresh Corp"]);
        expect(searchVendors("gone corp")).toEqual([]);

        expect(importInfo).toMatchObject({
            totalCount: 3,
            approvedCount: 2,
            addedCount: 1,
            removedCount: 1,
            changedCount: 1,
        });
        expect(getLatestImport()?.id).toBe(importInfo.id);
    });

    it("refuses a stale preview and leaves the list untouched", () => {
        const { importInfo: first } = applyVendorImport([vendor({ supplierName: "A" })], meta);
        applyVendorImport([vendor({ supplierName: "B" })], meta);

        expect(() =>
            applyVendorImport([vendor({ supplierName: "C" })], {
                ...meta,
                expectedBaseImportId: first.id,
            })
        ).toThrow(VendorImportConflictError);
        expect(getCurrentVendors().map((v) => v.supplierName)).toEqual(["B"]);
    });

    it("refuses a preview taken before the first import once one exists", () => {
        applyVendorImport([vendor({ supplierName: "A" })], meta);
        expect(() =>
            applyVendorImport([vendor({ supplierName: "B" })], {
                ...meta,
                expectedBaseImportId: null,
            })
        ).toThrow(VendorImportConflictError);
    });
});
