import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { apiKey, user } from "@/lib/db/schema";
import { hashApiKey } from "@/lib/security/api-key";
import { clientIp, rateLimit, rateLimitStatus } from "@/lib/security/rate-limit";
import { isValidAccessCode } from "./access-code";

export type SimCaller = { via: "api-key"; userId: string; name: string } | { via: "access-code" };

// Six digits is a small space, so wrong codes get a far tighter budget than the
// general per-IP limit. Only failures spend a token, which means a member using
// the right code all day never runs into it.
const CODE_ATTEMPT_LIMIT = { capacity: 10, windowMs: 60 * 60 * 1000 };

const UNAUTHORIZED = {
    error: "Send a valid X-API-Key or X-Access-Code header",
};

/**
 * Auth for the public sim endpoints. Accepts either a personal dashboard API
 * key or the rotating daily access code (see access-code.ts). Returns the
 * caller, or the response to send back.
 */
export function authenticateSimRequest(req: Request): SimCaller | NextResponse {
    const providedKey = req.headers.get("x-api-key");
    if (providedKey) {
        const row = db
            .select({
                keyId: apiKey.id,
                userId: user.id,
                name: user.name,
                isActive: user.isActive,
            })
            .from(apiKey)
            .innerJoin(user, eq(apiKey.userId, user.id))
            .where(and(eq(apiKey.keyHash, hashApiKey(providedKey)), eq(apiKey.isRevoked, false)))
            .get();

        if (!row?.isActive) {
            return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
        }

        db.update(apiKey).set({ lastUsedAt: new Date() }).where(eq(apiKey.id, row.keyId)).run();
        return { via: "api-key", userId: row.userId, name: row.name };
    }

    const providedCode = req.headers.get("x-access-code");
    if (providedCode) {
        const bucket = `sim-code:${clientIp(req)}`;
        const limit = rateLimitStatus(bucket, CODE_ATTEMPT_LIMIT);
        if (!limit.allowed) {
            return NextResponse.json(
                { error: "Too many incorrect codes, try again later" },
                { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
            );
        }

        if (!isValidAccessCode(providedCode)) {
            rateLimit(bucket, CODE_ATTEMPT_LIMIT);
            return NextResponse.json(
                { error: "That code is not today's code. Ask a lead for the current one." },
                { status: 401 }
            );
        }

        return { via: "access-code" };
    }

    return NextResponse.json(UNAUTHORIZED, { status: 401 });
}
