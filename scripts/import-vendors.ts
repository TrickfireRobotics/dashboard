// Imports the finance office's supplier export (an .xlsx) into the
// approved_vendors table and (re)builds the FTS5 search index. Idempotent:
// clears and repopulates on every run.
//
// Usage:  pnpm db:import-vendors [path/to/vendors.xlsx]
// Default path is the export that ships next to the repo.
//
// Load env before importing db/index.ts, which reads DATABASE_PATH at import
// time (mirrors scripts/seed.ts). Static ESM imports hoist, so db is imported
// dynamically inside main().
for (const f of [".env.local", ".env.production"]) {
    try {
        process.loadEnvFile(f);
        break;
    } catch {
        /* try next */
    }
}

import { readFileSync } from "node:fs";

import * as XLSX from "xlsx";

import type { VendorStatus } from "../src/lib/db/schema";
import { normalizeVendorName } from "../src/lib/vendors/approval";

const DEFAULT_XLSX = "../vendors 2026-09-14 09_35 PDT.xlsx";

// Column positions in the export (0-based), matching the header row:
// A Supplier, B Supplier Name, C Supplier ID, D Supplier Status, E Category,
// F Group, G UEI, ... J Use For, K Email, ... M Contact, ... R Remit-To.
const COL = {
    supplier: 0,
    supplierName: 1,
    supplierId: 2,
    status: 3,
    category: 4,
    group: 5,
    uei: 6,
    useFor: 9,
    email: 10,
    contact: 12,
    remitAddress: 17,
} as const;

type VendorRecord = {
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

// Lower rank wins when the same supplier appears with conflicting statuses.
const STATUS_RANK: Record<VendorStatus, number> = {
    Active: 0,
    Hold: 1,
    Inactive: 2,
    Unknown: 3,
};

function cell(row: unknown[], index: number): string {
    const v = row[index];
    return v == null ? "" : String(v).trim();
}

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

function parseRows(path: string): VendorRecord[] {
    const wb = XLSX.read(readFileSync(path), { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: false,
        blankrows: false,
    });

    // Dedupe to one row per supplier name; many rows are duplicate primary /
    // alternate contacts for the same supplier. Prefer the most-approved status.
    const byName = new Map<string, VendorRecord>();
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const name = cell(row, COL.supplierName) || cell(row, COL.supplier);
        if (!name) continue;

        const status = normalizeStatus(cell(row, COL.status));
        const record: VendorRecord = {
            supplierName: name,
            supplierId: blankToNull(cell(row, COL.supplierId)),
            status,
            category: blankToNull(cell(row, COL.category)),
            group: blankToNull(cell(row, COL.group)),
            uei: blankToNull(cell(row, COL.uei)),
            email: blankToNull(cell(row, COL.email)),
            contact: blankToNull(cell(row, COL.contact)),
            remitAddress: blankToNull(cell(row, COL.remitAddress)),
            useFor: blankToNull(cell(row, COL.useFor)),
        };

        const existing = byName.get(name);
        if (!existing) {
            byName.set(name, record);
            continue;
        }
        // Keep the better status; backfill any fields the kept record is missing.
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
    return [...byName.values()];
}

async function main() {
    const path = process.argv[2] ?? DEFAULT_XLSX;
    const { sqlite } = await import("../src/lib/db");

    console.log(`Reading ${path} ...`);
    const records = parseRows(path);
    console.log(`Parsed ${records.length} distinct vendors.`);

    sqlite.exec("DELETE FROM approved_vendors;");

    const insert = sqlite.prepare(
        `INSERT INTO approved_vendors
           (supplier_name, search_name, supplier_id, status, approved, category, "group",
            unique_entity_identifier, email, contact, remit_address, use_for, imported_at)
         VALUES
           (@supplierName, @searchName, @supplierId, @status, @approved, @category, @group,
            @uei, @email, @contact, @remitAddress, @useFor, @importedAt)`
    );
    const now = Date.now();
    const insertAll = sqlite.transaction((rows: VendorRecord[]) => {
        for (const r of rows) {
            insert.run({
                supplierName: r.supplierName,
                searchName: normalizeVendorName(r.supplierName),
                supplierId: r.supplierId,
                status: r.status,
                approved: r.status === "Active" ? 1 : 0,
                category: r.category,
                group: r.group,
                uei: r.uei,
                email: r.email,
                contact: r.contact,
                remitAddress: r.remitAddress,
                useFor: r.useFor,
                importedAt: now,
            });
        }
    });
    insertAll(records);

    // Rebuild the standalone trigram FTS index (rowid mirrors approved_vendors.id).
    // Drizzle can't express FTS5, so this lives here rather than in a migration.
    sqlite.exec(`
        DROP TABLE IF EXISTS approved_vendors_fts;
        CREATE VIRTUAL TABLE approved_vendors_fts USING fts5(
            search_name, supplier_id, tokenize='trigram'
        );
        INSERT INTO approved_vendors_fts(rowid, search_name, supplier_id)
            SELECT id, search_name, coalesce(supplier_id, '') FROM approved_vendors;
    `);

    const active = records.filter((r) => r.status === "Active").length;
    console.log(
        `Imported ${records.length} vendors (${active} approved / ${records.length - active} out of scope). FTS index built.`
    );
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
