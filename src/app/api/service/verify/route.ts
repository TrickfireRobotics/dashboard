import { NextResponse, type NextRequest } from "next/server";

import { formatRotationTime, nextRotation } from "@/lib/sim/access-code";
import { authenticateSimRequest } from "@/lib/sim/request-auth";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

// Public endpoint reachable via Cloudflare Tunnel - sim scripts authenticate
// with an X-API-Key or X-Access-Code header. Rate limited per client IP.
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

    if (caller.via === "access-code") {
        const rotatesAt = nextRotation();
        return NextResponse.json({
            via: "access-code",
            name: "today's access code",
            expiresAt: rotatesAt.toISOString(),
            expiresAtLabel: formatRotationTime(rotatesAt),
        });
    }

    return NextResponse.json({ via: "api-key", userId: caller.userId, name: caller.name });
}
