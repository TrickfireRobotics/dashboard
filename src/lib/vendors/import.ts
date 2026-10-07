// Parses the finance office's supplier export (.xlsx), diffs it against the
// approved_vendors table, and applies the diff. Shared by the Finance-page
// upload (src/app/api/admin/vendors/import) and scripts/import-vendors.ts.

import { createHash } from "node:crypto";

import { desc, eq } from "drizzle-orm";
import * as XLSX from "xlsx";

import { db, sqlite } from "@/lib/db";
import { approvedVendor, user, vendorImport, type VendorStatus } from "@/lib/db/schema";
import { isApproved, normalizeVendorName } from "@/lib/vendors/approval";

export type VendorRecord = {
    supplierName: string;
    supplierId: string | null;
    status: VendorStatus;
    category: string | null;
    group: string | null;
    uei: string | null;
    email: string | null;
    contact: string | null;
    remitAddress: string | null;
    useFor: string | null;
};

// Every field besides the name (the diff key) that a re-import can change.
export const VENDOR_FIELDS = [
    "status",
    "supplierId",
    "category",
    "group",
    "uei",
    "email",
    "contact",
    "remitAddress",
    "useFor",
] as const satisfies readonly (keyof VendorRecord)[];

export type VendorField = (typeof VENDOR_FIELDS)[number];

export type VendorChange = {
    supplierName: string;
    before: VendorRecord;
    after: VendorRecord;
    fields: VendorField[];
};

export type VendorDiff = {
    added: VendorRecord[];
    removed: VendorRecord[];
    changed: VendorChange[];
    unchangedCount: number;
};

export type VendorImportInfo = {
    id: number;
    importedAt: Date;
    importedByName: string | null;
    fileName: string;
    totalCount: number;
    approvedCount: number;
    addedCount: number;
    removedCount: number;
    changedCount: number;
};

// A user-facing problem with the uploaded file (wrong spreadsheet, no rows).
export class VendorImportError extends Error {}

// The vendor list was changed by another import after the caller previewed.
export class VendorImportConflictError extends Error {}

// Source columns, located by header text so a reordered export still parses.
// Only the name and status columns are required; the rest import as null when
// missing.
const HEADERS = {
    supplier: "Supplier",
    supplierName: "Supplier Name",
    supplierId: "Supplier ID",
    status: "Supplier Status",
    category: "Supplier Category",
    group: "Supplier Group",
    uei: "Unique Entity Identifier",
    useFor: "Use For",
    email: "Email Address",
    contact: "Contact",
    remitAddress: "Remit-To Address",
} as const;

const REQUIRED_HEADERS = [HEADERS.supplierName, HEADERS.status];

// Lower rank wins when the same supplier appears with conflicting statuses.
const STATUS_RANK: Record<VendorStatus, number> = {
    Active: 0,
    Hold: 1,
    Inactive: 2,
    Unknown: 3,
};

const FTS_TABLE = "approved_vendors_fts";

function normalizeStatus(raw: string): VendorStatus {
    switch (raw.toLowerCase()) {
        case "active":
            return "Active";
        case "inactive":
            return "Inactive";
        case "hold":
            return "Hold";
        default:
            return "Unknown";
    }
}

function blankToNull(s: string): string | null {
    return s === "" ? null : s;
}

export function hashFile(data: Uint8Array): string {
    return createHash("sha256").update(data).digest("hex");
}

/**
 * Reads the first sheet of a supplier export into one record per supplier
 * name. Many source rows are duplicate primary/alternate contacts for the same
 * supplier; those collapse to the most-approved status, backfilling any fields
 * the kept row is missing. Throws VendorImportError for a file that isn't a
 * supplier export.
 */
export function parseVendorWorkbook(data: Uint8Array): VendorRecord[] {
    let rows: unknown[][];
    try {
        const wb = XLSX.read(data, { type: "buffer" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
            header: 1,
            raw: false,
            blankrows: false,
        });
    } catch {
        throw new VendorImportError("Couldn't read that file as a spreadsheet.");
    }

    const header = (rows[0] ?? []).map((v) => (v == null ? "" : String(v).trim()));
    const missing = REQUIRED_HEADERS.filter((h) => !header.includes(h));
    if (missing.length > 0) {
        throw new VendorImportError(
            `This doesn't look like the supplier export: missing column${missing.length > 1 ? "s" : ""} ${missing.map((h) => `"${h}"`).join(", ")}.`
        );
    }

    const col = Object.fromEntries(
        Object.entries(HEADERS).map(([key, text]) => [key, header.indexOf(text)])
    ) as Record<keyof typeof HEADERS, number>;

    const cell = (row: unknown[], index: number): string => {
        if (index < 0) return "";
        const v = row[index];
        // Normalize line endings so multi-line cells (remit addresses) compare
        // equal across exports and parser versions.
        return v == null ? "" : String(v).replace(/\r\n?/g, "\n").trim();
    };

    const byName = new Map<string, VendorRecord>();
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const name = cell(row, col.supplierName) || cell(row, col.supplier);
        if (!name) continue;

        const status = normalizeStatus(cell(row, col.status));
        const record: VendorRecord = {
            supplierName: name,
            supplierId: blankToNull(cell(row, col.supplierId)),
            status,
            category: blankToNull(cell(row, col.category)),
            group: blankToNull(cell(row, col.group)),
            uei: blankToNull(cell(row, col.uei)),
            email: blankToNull(cell(row, col.email)),
            contact: blankToNull(cell(row, col.contact)),
            remitAddress: blankToNull(cell(row, col.remitAddress)),
            useFor: blankToNull(cell(row, col.useFor)),
        };

        const existing = byName.get(name);
        if (!existing) {
            byName.set(name, record);
            continue;
        }
        const winner = STATUS_RANK[status] < STATUS_RANK[existing.status] ? record : existing;
        const loser = winner === record ? existing : record;
        byName.set(name, {
            ...winner,
            supplierId: winner.supplierId ?? loser.supplierId,
            category: winner.category ?? loser.category,
            group: winner.group ?? loser.group,
            uei: winner.uei ?? loser.uei,
            email: winner.email ?? loser.email,
            contact: winner.contact ?? loser.contact,
            remitAddress: winner.remitAddress ?? loser.remitAddress,
            useFor: winner.useFor ?? loser.useFor,
        });
    }

    if (byName.size === 0) {
        throw new VendorImportError("The spreadsheet has the right columns but no vendor rows.");
    }
    return [...byName.values()];
}

export function getCurrentVendors(): VendorRecord[] {
    return db
        .select({
            supplierName: approvedVendor.supplierName,
            supplierId: approvedVendor.supplierId,
            status: approvedVendor.status,
            category: approvedVendor.category,
            group: approvedVendor.group,
            uei: approvedVendor.uei,
            email: approvedVendor.email,
            contact: approvedVendor.contact,
            remitAddress: approvedVendor.remitAddress,
            useFor: approvedVendor.useFor,
        })
        .from(approvedVendor)
        .all();
}

const compareByName = (a: { supplierName: string }, b: { supplierName: string }) =>
    a.supplierName.localeCompare(b.supplierName);

/** Diffs the stored list against an incoming one, keyed on supplier name. */
export function diffVendors(current: VendorRecord[], incoming: VendorRecord[]): VendorDiff {
    const currentByName = new Map(current.map((v) => [v.supplierName, v]));
    const incomingNames = new Set(incoming.map((v) => v.supplierName));

    const added: VendorRecord[] = [];
    const changed: VendorChange[] = [];
    let unchangedCount = 0;

    for (const after of incoming) {
        const before = currentByName.get(after.supplierName);
        if (!before) {
            added.push(after);
            continue;
        }
        const fields = VENDOR_FIELDS.filter((f) => before[f] !== after[f]);
        if (fields.length === 0) {
            unchangedCount++;
        } else {
            changed.push({ supplierName: after.supplierName, before, after, fields });
        }
    }

    const removed = current.filter((v) => !incomingNames.has(v.supplierName));

    return {
        added: added.sort(compareByName),
        removed: removed.sort(compareByName),
        changed: changed.sort(compareByName),
        unchangedCount,
    };
}

export function getLatestImport(): VendorImportInfo | null {
    const row = db
        .select({
            id: vendorImport.id,
            importedAt: vendorImport.importedAt,
            importedByName: user.name,
            fileName: vendorImport.fileName,
            totalCount: vendorImport.totalCount,
            approvedCount: vendorImport.approvedCount,
            addedCount: vendorImport.addedCount,
            removedCount: vendorImport.removedCount,
            changedCount: vendorImport.changedCount,
        })
        .from(vendorImport)
        .leftJoin(user, eq(vendorImport.importedBy, user.id))
        .orderBy(desc(vendorImport.id))
        .limit(1)
        .get();
    return row ?? null;
}

export type ApplyVendorImportOptions = {
    fileName: string;
    fileHash: string;
    importedBy: string | null;
    // The latest import id the caller previewed against (null = none yet).
    // When given and no longer the latest, the apply is refused with
    // VendorImportConflictError. Omit to apply unconditionally (CLI).
    expectedBaseImportId?: number | null;
};

/**
 * Brings approved_vendors in line with `incoming` in one transaction: deletes
 * removed vendors, inserts added ones, updates changed ones in place (so ids of
 * untouched rows stay stable), rebuilds the FTS index, and logs the import.
 * Any failure rolls the whole thing back.
 */
export function applyVendorImport(
    incoming: VendorRecord[],
    options: ApplyVendorImportOptions
): { diff: VendorDiff; importInfo: VendorImportInfo } {
    const run = sqlite.transaction(() => {
        if (options.expectedBaseImportId !== undefined) {
            const latestId = getLatestImport()?.id ?? null;
            if (latestId !== options.expectedBaseImportId) {
                throw new VendorImportConflictError(
                    "The vendor list was updated since this preview. Upload the file again to see the current changes."
                );
            }
        }

        const diff = diffVendors(getCurrentVendors(), incoming);
        const now = new Date();

        for (const v of diff.removed) {
            db.delete(approvedVendor).where(eq(approvedVendor.supplierName, v.supplierName)).run();
        }
        for (const v of diff.added) {
            db.insert(approvedVendor)
                .values({
                    ...v,
                    searchName: normalizeVendorName(v.supplierName),
                    approved: isApproved(v.status),
                    importedAt: now,
                })
                .run();
        }
        for (const { after } of diff.changed) {
            const { supplierName, ...fields } = after;
            db.update(approvedVendor)
                .set({ ...fields, approved: isApproved(after.status), importedAt: now })
                .where(eq(approvedVendor.supplierName, supplierName))
                .run();
        }

        // Rebuild the standalone trigram FTS index (rowid mirrors
        // approved_vendors.id). Drizzle can't express FTS5, so it lives here
        // rather than in a migration.
        sqlite.exec(`
            DROP TABLE IF EXISTS ${FTS_TABLE};
            CREATE VIRTUAL TABLE ${FTS_TABLE} USING fts5(
                search_name, supplier_id, tokenize='trigram'
            );
            INSERT INTO ${FTS_TABLE}(rowid, search_name, supplier_id)
                SELECT id, search_name, coalesce(supplier_id, '') FROM approved_vendors;
        `);

        db.insert(vendorImport)
            .values({
                importedAt: now,
                importedBy: options.importedBy,
                fileName: options.fileName,
                fileHash: options.fileHash,
                totalCount: incoming.length,
                approvedCount: incoming.filter((v) => isApproved(v.status)).length,
                addedCount: diff.added.length,
                removedCount: diff.removed.length,
                changedCount: diff.changed.length,
            })
            .run();

        return diff;
    });

    // IMMEDIATE takes the write lock up front. A deferred transaction would
    // start as a reader and fail with SQLITE_BUSY (no busy-wait) when it tries
    // to upgrade while another connection (the server vs. the CLI) is writing.
    const diff = run.immediate();
    return { diff, importInfo: getLatestImport()! };
}
