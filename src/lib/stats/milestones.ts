/**
 * Stats for the /milestones poster page.
 *
 * Deliberately computed with no `revalidate`/dynamic APIs so Next prerenders
 * this page once at `next build` time. Production runs from the `standalone`
 * output (see next.config.ts), which drops raw `src/` source and `.git` -
 * so counting lines or shelling out to git only works while the full repo
 * checkout is still on disk, i.e. during the build itself. The numbers are a
 * snapshot as of the last deploy, which happens on every push to main.
 */

import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";

export type MilestoneStats = {
    linesOfCode: number;
    fileCount: number;
    commitCount: number | null;
    daysInDevelopment: number | null;
    apiRouteCount: number;
    dbTableCount: number;
    teamMemberCount: number;
    generatedAt: string;
};

function git(args: string[]): string | null {
    try {
        return execFileSync("git", args, { cwd: process.cwd(), encoding: "utf8" }).trim();
    } catch {
        return null;
    }
}

/**
 * Lines and file count across every tracked `.ts`/`.tsx` file (respects
 * .gitignore). Counted via a single shell pipeline rather than per-file
 * `fs.readFile` calls - Next's file tracer can't statically resolve a
 * `path.join(cwd, dynamicVar)` read in a loop and falls back to bundling the
 * entire project into the standalone output "just in case."
 */
function countTypeScriptLoc(): { lines: number; files: number } {
    const listing = git(["ls-files", "*.ts", "*.tsx"]);
    const fileCount = listing ? listing.split("\n").filter(Boolean).length : 0;
    if (fileCount === 0) return { lines: 0, files: 0 };

    const wc = (() => {
        try {
            return execFileSync(
                "bash",
                ["-c", "git ls-files -z '*.ts' '*.tsx' | xargs -0 cat | wc -l"],
                { cwd: process.cwd(), encoding: "utf8" }
            ).trim();
        } catch {
            return null;
        }
    })();

    return { lines: wc ? Number.parseInt(wc, 10) || 0 : 0, files: fileCount };
}

function countCommits(): number | null {
    const out = git(["rev-list", "--count", "HEAD"]);
    if (!out) return null;
    const n = Number.parseInt(out, 10);
    return Number.isNaN(n) ? null : n;
}

function daysSinceFirstCommit(): number | null {
    // `git log --reverse -1` is a classic trap: the `-1` limit is applied
    // before the reversed traversal, so it returns the latest commit, not
    // the earliest. Walk to the actual root of the DAG instead.
    const rootHash = git(["rev-list", "--max-parents=0", "HEAD"])?.split("\n")[0];
    if (!rootHash) return null;
    const iso = git(["show", "-s", "--format=%cI", rootHash]);
    if (!iso) return null;
    const first = new Date(iso).getTime();
    if (Number.isNaN(first)) return null;
    return Math.floor((Date.now() - first) / (1000 * 60 * 60 * 24));
}

function countApiRoutes(): number {
    const listing = git(["ls-files", "src/app/api/**/route.ts"]);
    return listing ? listing.split("\n").filter(Boolean).length : 0;
}

async function countDbTables(): Promise<number> {
    try {
        const schema = await readFile(path.join(process.cwd(), "src/lib/db/schema.ts"), "utf8");
        return (schema.match(/=\s*sqliteTable\(/g) ?? []).length;
    } catch {
        return 0;
    }
}

/** Approved, active members registered in the dashboard - not GitHub org members. */
function countDashboardMembers(): number {
    return db
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.approved, true), eq(user.isActive, true)))
        .all().length;
}

export async function getMilestoneStats(): Promise<MilestoneStats> {
    const { lines, files } = countTypeScriptLoc();
    const dbTableCount = await countDbTables();

    return {
        linesOfCode: lines,
        fileCount: files,
        commitCount: countCommits(),
        daysInDevelopment: daysSinceFirstCommit(),
        apiRouteCount: countApiRoutes(),
        dbTableCount,
        teamMemberCount: countDashboardMembers(),
        generatedAt: new Date().toISOString(),
    };
}
