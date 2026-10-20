import { NextResponse } from "next/server";

import { clientIp, rateLimit, rateLimitStatus } from "@/lib/security/rate-limit";
import { isValidAccessCode } from "./access-code";

// Six digits is a small space, so wrong codes get a far tighter budget than the
// general per-IP limit. Only failures spend a token, which means a member using
// the right code all day never runs into it.
const CODE_ATTEMPT_LIMIT = { capacity: 10, windowMs: 60 * 60 * 1000 };

/**
 * Auth for the public sim endpoints: the current club access code, sent as
 * X-Access-Code. Returns null when the caller is good, or the response to send.
 */
export function authenticateSimRequest(req: Request): NextResponse | null {
    const provided = req.headers.get("x-access-code");
    if (!provided) {
        return NextResponse.json(
            { error: "Missing X-Access-Code. Ask a lead for the current sim access code." },
            { status: 401 }
        );
    }

    const bucket = `sim-code:${clientIp(req)}`;
    const limit = rateLimitStatus(bucket, CODE_ATTEMPT_LIMIT);
    if (!limit.allowed) {
        return NextResponse.json(
            { error: "Too many incorrect codes, try again later" },
            { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
        );
    }

    if (!isValidAccessCode(provided)) {
        rateLimit(bucket, CODE_ATTEMPT_LIMIT);
        return NextResponse.json(
            { error: "That is not the current access code. Ask a lead for it." },
            { status: 401 }
        );
    }

    return null;
}
