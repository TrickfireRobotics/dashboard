import { and, asc, eq, gt, sql as drizzleSql } from "drizzle-orm";
import { rm } from "fs/promises";

import { db } from "@/lib/db";
import { simExportCache } from "@/lib/db/schema";

const MAX_ENTRIES = Number(process.env.SIM_CACHE_MAX_ENTRIES ?? "50");
const TTL_MS = Number(process.env.SIM_CACHE_TTL_DAYS ?? "7") * 24 * 60 * 60 * 1000;

export function getCacheEntry(docId: string, wsId: string, elId: string) {
    const cutoff = new Date(Date.now() - TTL_MS);
    return (
        db
            .select()
            .from(simExportCache)
            .where(
                and(
                    eq(simExportCache.documentId, docId),
                    eq(simExportCache.workspaceId, wsId),
                    eq(simExportCache.elementId, elId),
                    gt(simExportCache.cachedAt, cutoff)
                )
            )
            .get() ?? null
    );
}

export function touchCacheEntry(id: number) {
    db.update(simExportCache)
        .set({
            lastAccessedAt: new Date(),
            accessCount: drizzleSql`${simExportCache.accessCount} + 1`,
        })
        .where(eq(simExportCache.id, id))
        .run();
}

export function upsertCacheEntry(
    docId: string,
    wsId: string,
    elId: string,
    archivePath: string,
    sizeBytes: number
) {
    db.delete(simExportCache)
        .where(
            and(
                eq(simExportCache.documentId, docId),
                eq(simExportCache.workspaceId, wsId),
                eq(simExportCache.elementId, elId)
            )
        )
        .run();

    return db
        .insert(simExportCache)
        .values({
            documentId: docId,
            workspaceId: wsId,
            elementId: elId,
            archivePath,
            archiveSizeBytes: sizeBytes,
        })
        .returning()
        .get();
}

export async function evictIfNeeded() {
    const all = db
        .select({ id: simExportCache.id, archivePath: simExportCache.archivePath })
        .from(simExportCache)
        .orderBy(asc(simExportCache.lastAccessedAt))
        .all();

    if (all.length <= MAX_ENTRIES) return;

    const toEvict = all.slice(0, all.length - MAX_ENTRIES);
    for (const entry of toEvict) {
        await rm(entry.archivePath, { force: true });
        db.delete(simExportCache).where(eq(simExportCache.id, entry.id)).run();
    }
}
