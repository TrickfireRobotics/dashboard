import { LRUCache } from "lru-cache";

type Bucket = { tokens: number; updatedAt: number };

// Token bucket: full bucket of CAPACITY tokens, refilled steadily over a minute.
const CAPACITY = 30;
const REFILL_PER_MS = CAPACITY / 60_000;

const buckets = new LRUCache<string, Bucket>({
  max: 5_000,
  ttl: 1000 * 60 * 10,
});

export type RateLimitResult = { allowed: boolean; retryAfter: number };

export function rateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: CAPACITY, updatedAt: now };

  const refill = (now - bucket.updatedAt) * REFILL_PER_MS;
  bucket.tokens = Math.min(CAPACITY, bucket.tokens + refill);
  bucket.updatedAt = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    buckets.set(key, bucket);
    return { allowed: true, retryAfter: 0 };
  }

  buckets.set(key, bucket);
  const retryAfter = Math.ceil((1 - bucket.tokens) / REFILL_PER_MS / 1000);
  return { allowed: false, retryAfter };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}
