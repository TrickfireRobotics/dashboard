// Imports the finance office's supplier export (an .xlsx) into approved_vendors
// from the command line. Same diff-and-apply as the Finance-page upload
// (src/lib/vendors/import.ts); handy for local dev.
//
// Usage:  pnpm db:import-vendors [path/to/vendors.xlsx] [--dry-run]
// Default path is the export that ships next to the repo. --dry-run prints the
// diff without changing anything.
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
import { basename } from "node:path";

const DEFAULT_XLSX = "../vendors 2026-09-14 09_35 PDT.xlsx";
const PREVIEW_LIMIT = 20;

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes("--dry-run");
    const path = args.find((a) => !a.startsWith("--")) ?? DEFAULT_XLSX;

    const { applyVendorImport, diffVendors, getCurrentVendors, hashFile, parseVendorWorkbook } =
        await import("../src/lib/vendors/import");

    console.log(`Reading ${path} ...`);
    const data = readFileSync(path);
    const records = parseVendorWorkbook(data);
    console.log(`Parsed ${records.length} distinct vendors.`);

    const diff = diffVendors(getCurrentVendors(), records);
    console.log(
        `+${diff.added.length} added, -${diff.removed.length} removed, ~${diff.changed.length} changed, ${diff.unchangedCount} unchanged.`
    );

    if (dryRun) {
        for (const v of diff.added.slice(0, PREVIEW_LIMIT)) console.log(`  + ${v.supplierName}`);
        for (const v of diff.removed.slice(0, PREVIEW_LIMIT)) console.log(`  - ${v.supplierName}`);
        for (const c of diff.changed.slice(0, PREVIEW_LIMIT)) {
            const fields = c.fields.map((f) => `${f}: ${c.before[f]} -> ${c.after[f]}`).join(", ");
            console.log(`  ~ ${c.supplierName} (${fields})`);
        }
        console.log("Dry run: nothing changed.");
        return;
    }

    const { importInfo } = applyVendorImport(records, {
        fileName: basename(path),
        fileHash: hashFile(data),
        importedBy: null,
    });
    console.log(
        `Imported ${importInfo.totalCount} vendors (${importInfo.approvedCount} approved). FTS index built.`
    );
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err instanceof Error ? err.message : err);
        process.exit(1);
    });
