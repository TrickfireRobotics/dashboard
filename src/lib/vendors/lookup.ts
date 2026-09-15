import { eq } from "drizzle-orm";

import { db, sqlite } from "@/lib/db";
import { approvedVendor, type VendorStatus } from "@/lib/db/schema";
import { normalizeVendorName } from "@/lib/vendors/approval";

export type VendorHit = {
    id: number;
    supplierName: string;
    supplierId: string | null;
    status: VendorStatus;
    approved: boolean;
};

const FTS_TABLE = "approved_vendors_fts";

// The FTS5 trigram tokenizer needs at least 3 characters to form a trigram;
// shorter queries fall back to a prefix LIKE so a 1-2 char query still returns
// something sensible.
const MIN_TRIGRAM_LENGTH = 3;

type VendorRow = {
    id: number;
    supplier_name: string;
    supplier_id: string | null;
    status: VendorStatus;
    approved: number;
};

function toHit(row: VendorRow): VendorHit {
    return {
        id: row.id,
        supplierName: row.supplier_name,
        supplierId: row.supplier_id,
        status: row.status,
        approved: row.approved === 1,
    };
}

function ftsAvailable(): boolean {
    const row = sqlite
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
        .get(FTS_TABLE);
    return row !== undefined;
}

function searchWithLike(q: string, limit: number): VendorHit[] {
    const namePattern = `%${normalizeVendorName(q)}%`;
    const rawPattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    const rows = sqlite
        .prepare(
            `SELECT id, supplier_name, supplier_id, status, approved
             FROM approved_vendors
             WHERE search_name LIKE ? OR supplier_id LIKE ? ESCAPE '\\'
             ORDER BY approved DESC, length(supplier_name) ASC
             LIMIT ?`
        )
        .all(namePattern, rawPattern, limit) as VendorRow[];
    return rows.map(toHit);
}

/**
 * Ranked keyword search over the approved-vendor list. Case-insensitive,
 * partial/substring matching via FTS5 trigram, best matches first. Approved
 * vendors are nudged ahead of out-of-scope ones at equal relevance. Returns []
 * for an empty query.
 */
export function searchVendors(query: string, limit = 10): VendorHit[] {
    const q = query.trim();
    if (!q) return [];

    // Match on the normalized key so punctuation/spacing differences
    // ("digikey" vs "Digi-Key") still hit.
    const normalized = normalizeVendorName(q);
    if (normalized.length < MIN_TRIGRAM_LENGTH || !ftsAvailable()) {
        return searchWithLike(q, limit);
    }

    // One FTS5 phrase over the normalized index; the value is already
    // alphanumeric-only, so no query-syntax characters remain to escape.
    const phrase = `"${normalized}"`;
    const rows = sqlite
        .prepare(
            `SELECT v.id, v.supplier_name, v.supplier_id, v.status, v.approved
             FROM ${FTS_TABLE}
             JOIN approved_vendors v ON v.id = ${FTS_TABLE}.rowid
             WHERE ${FTS_TABLE} MATCH ?
             ORDER BY v.approved DESC, bm25(${FTS_TABLE})
             LIMIT ?`
        )
        .all(phrase, limit) as VendorRow[];
    return rows.map(toHit);
}

/**
 * Exact-name lookup used to resolve the approval flag for a vendor the user
 * typed or picked in the order form. Returns null when the name isn't in the
 * list (i.e. out of scope).
 */
export function getVendorByExactName(name: string): VendorHit | null {
    const n = name.trim();
    if (!n) return null;
    const row = db
        .select({
            id: approvedVendor.id,
            supplierName: approvedVendor.supplierName,
            supplierId: approvedVendor.supplierId,
            status: approvedVendor.status,
            approved: approvedVendor.approved,
        })
        .from(approvedVendor)
        .where(eq(approvedVendor.searchName, normalizeVendorName(n)))
        .get();
    return row ?? null;
}
