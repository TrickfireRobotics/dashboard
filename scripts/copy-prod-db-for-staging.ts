// Copies the live prod database into staging using SQLite's online backup
// API instead of a plain file copy. Prod runs in WAL mode, so most recent
// writes live in dashboard.db-wal rather than the base .db file - a plain
// `cp` of just the base file misses everything not yet checkpointed. The
// backup API reads a consistent snapshot (base file + WAL) without
// interrupting the live service.

import Database from "better-sqlite3";

const prodPath = process.argv[2];
const stagingPath = process.argv[3];

if (!prodPath || !stagingPath) {
    console.error("Usage: tsx copy-prod-db-for-staging.ts <prod-db-path> <staging-db-path>");
    process.exit(1);
}

async function main() {
    const prod = new Database(prodPath, { readonly: true });
    await prod.backup(stagingPath);
    prod.close();
    console.log(`Copied ${prodPath} -> ${stagingPath}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
