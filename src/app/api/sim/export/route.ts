import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { and, eq } from "drizzle-orm";
import { Readable } from "stream";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { apiKey, user } from "@/lib/db/schema";
import { hashApiKey } from "@/lib/security/api-key";
import { getCacheEntry, touchCacheEntry, upsertCacheEntry, evictIfNeeded } from "@/lib/sim/cache";
import { runOnshapeExport } from "@/lib/sim/export";
import { isOnshapeConfigured } from "@/lib/integrations/onshape";

const ONSHAPE_URL_RE = /documents\/([0-9a-f]+)\/[wv]\/([0-9a-f]+)\/e\/([0-9a-f]+)/i;

export async function POST(req: NextRequest) {
    const provided = req.headers.get("x-api-key");
    if (!provided) {
        return NextResponse.json({ error: "Missing X-API-Key" }, { status: 401 });
    }

    const row = db
        .select({ userId: user.id, isActive: user.isActive })
        .from(apiKey)
        .innerJoin(user, eq(apiKey.userId, user.id))
        .where(and(eq(apiKey.keyHash, hashApiKey(provided)), eq(apiKey.isRevoked, false)))
        .get();

    if (!row?.isActive) {
        return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    if (!isOnshapeConfigured()) {
        return NextResponse.json(
            { error: "OnShape is not configured on this server" },
            { status: 503 }
        );
    }

    const body = await req.json().catch(() => null);
    const onshapeUrl: string = body?.onshapeUrl ?? "";
    const forceRefresh: boolean = body?.forceRefresh === true;

    const match = ONSHAPE_URL_RE.exec(onshapeUrl);
    if (!match) {
        return NextResponse.json({ error: "Invalid OnShape URL" }, { status: 400 });
    }

    const [, docId, wsId, elId] = match;
    const parsed = new URL(onshapeUrl);
    const apiUrl = `${parsed.protocol}//${parsed.host}`;

    if (!forceRefresh) {
        const cached = getCacheEntry(docId, wsId, elId);
        if (cached) {
            touchCacheEntry(cached.id);
            return streamArchive(cached.archivePath);
        }
    }

    try {
        const { archivePath, sizeBytes } = await runOnshapeExport(docId, wsId, elId, apiUrl);
        upsertCacheEntry(docId, wsId, elId, archivePath, sizeBytes);
        void evictIfNeeded();
        return streamArchive(archivePath);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: `Export failed: ${message}` }, { status: 500 });
    }
}

async function streamArchive(archivePath: string): Promise<Response> {
    const { size } = await stat(archivePath);
    const nodeStream = createReadStream(archivePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
    return new Response(webStream, {
        headers: {
            "Content-Type": "application/gzip",
            "Content-Length": String(size),
            "Content-Disposition": 'attachment; filename="sim-export.tar.gz"',
        },
    });
}
