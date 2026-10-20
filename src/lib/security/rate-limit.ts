import { LRUCache } from "lru-cache";

type Bucket = { tokens: number; updatedAt: number };

// Token bucket: full bucket of CAPACITY tokens, refilled steadily over a minute.
const CAPACITY = 30;
const WINDOW_MS = 60_000;

const buckets = new LRUCache<string, Bucket>({
    max: 5_000,
    ttl: 1000 * 60 * 10,
});

export type RateLimitOptions = { capacity?: number; windowMs?: number };
export type RateLimitResult = { allowed: boolean; retryAfter: number };

function evaluate(key: string, opts: RateLimitOptions, consume: boolean): RateLimitResult {
    const capacity = opts.capacity ?? CAPACITY;
    const refillPerMs = capacity / (opts.windowMs ?? WINDOW_MS);
    const now = Date.now();
    const bucket = buckets.get(key) ?? { tokens: capacity, updatedAt: now };

    const refill = (now - bucket.updatedAt) * refillPerMs;
    bucket.tokens = Math.min(capacity, bucket.tokens + refill);
    bucket.updatedAt = now;

    if (bucket.tokens >= 1) {
        if (consume) bucket.tokens -= 1;
        buckets.set(key, bucket);
        return { allowed: true, retryAfter: 0 };
    }

    buckets.set(key, bucket);
    const retryAfter = Math.ceil((1 - bucket.tokens) / refillPerMs / 1000);
    return { allowed: false, retryAfter };
}

export function rateLimit(key: string, opts: RateLimitOptions = {}): RateLimitResult {
    return evaluate(key, opts, true);
}

/** Same check without spending a token, for limits that only count failures. */
export function rateLimitStatus(key: string, opts: RateLimitOptions = {}): RateLimitResult {
    return evaluate(key, opts, false);
}

export function clientIp(req: Request): string {
    const fwd = req.headers.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0]!.trim();
    return req.headers.get("cf-connecting-ip") ?? "unknown";
}
