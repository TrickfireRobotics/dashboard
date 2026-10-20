import { NextResponse, type NextRequest } from "next/server";

import { getCacheEntry, touchCacheEntry, upsertCacheEntry, evictIfNeeded } from "@/lib/sim/cache";
import { runOnshapeExport } from "@/lib/sim/export";
import { isOnshapeConfigured } from "@/lib/integrations/onshape";
import { createJob, startJob } from "@/lib/sim/jobs";
import { authenticateSimRequest } from "@/lib/sim/request-auth";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { streamArchive } from "@/lib/sim/stream";

const ONSHAPE_URL_RE = /documents\/([0-9a-f]+)\/[wv]\/([0-9a-f]+)\/e\/([0-9a-f]+)/i;

export async function POST(req: NextRequest) {
    const limit = rateLimit(clientIp(req));
    if (!limit.allowed) {
        return NextResponse.json(
            { error: "Too many requests" },
            { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
        );
    }

    const caller = authenticateSimRequest(req);
    if (caller instanceof NextResponse) return caller;

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

    const jobId = createJob();
    startJob(jobId, async () => {
        const result = await runOnshapeExport(docId, wsId, elId, apiUrl);
        upsertCacheEntry(docId, wsId, elId, result.archivePath, result.sizeBytes);
        void evictIfNeeded();
        return result;
    });

    return NextResponse.json({ jobId }, { status: 202 });
}
