// Deletes all rows from the session table so a staging DB copied from prod
// never carries over a live, reusable prod session cookie. Refuses to delete
// anything unless DATABASE_PATH clearly points at a staging database,
// mirroring the predb:reset production guard in package.json.

const dbPath = process.env.DATABASE_PATH ?? "";
if (!dbPath.includes("staging")) {
    console.error(
        `ERROR: wipe-staging-sessions refused to run against DATABASE_PATH="${dbPath}". ` +
            'This script only runs against a database path containing "staging".'
    );
    process.exit(1);
}

import { db } from "../src/lib/db";
import { session } from "../src/lib/db/schema";

async function main() {
    const result = db.delete(session).run();
    console.log(`Wiped ${result.changes} staging session(s).`);
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
