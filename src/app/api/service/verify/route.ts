import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { hashApiKey } from "@/lib/api-key";
import { db } from "@/lib/db";
import { apiKey, user } from "@/lib/db/schema";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// Public endpoint reachable via Cloudflare Tunnel - sim scripts authenticate
// with an X-API-Key header. Rate limited per client IP.
export async function POST(req: NextRequest) {
  const limit = rateLimit(clientIp(req));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const provided = req.headers.get("x-api-key");
  if (!provided) {
    return NextResponse.json({ error: "Missing X-API-Key" }, { status: 401 });
  }

  const row = db
    .select({
      keyId: apiKey.id,
      userId: user.id,
      name: user.name,
      isActive: user.isActive,
    })
    .from(apiKey)
    .innerJoin(user, eq(apiKey.userId, user.id))
    .where(
      and(eq(apiKey.keyHash, hashApiKey(provided)), eq(apiKey.isRevoked, false))
    )
    .get();

  if (!row || !row.isActive) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  db.update(apiKey)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKey.id, row.keyId))
    .run();

  return NextResponse.json({ userId: row.userId, name: row.name });
}
