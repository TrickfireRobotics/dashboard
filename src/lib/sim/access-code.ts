import { createHmac, timingSafeEqual } from "crypto";

// The sim CLI needs OnShape access but most members have no dashboard account.
// Instead of a personal API key they use a 6-digit code that any dashboard user
// can read off the settings page and pass along. The code is derived from a
// server secret plus the club-local date, so it rotates on its own at midnight
// and survives restarts without any storage.

const TIMEZONE = "America/Los_Angeles";

const dayFormat = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

const timeFormat = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
});

function secret(): string {
    const value = process.env.SIM_ACCESS_CODE_SECRET ?? process.env.BETTER_AUTH_SECRET;
    if (!value) {
        throw new Error("SIM_ACCESS_CODE_SECRET or BETTER_AUTH_SECRET must be set");
    }
    return value;
}

/** Club-local calendar day, e.g. "2026-10-19". */
export function accessCodeDay(at: Date = new Date()): string {
    return dayFormat.format(at);
}

export function accessCodeForDay(day: string): string {
    const digest = createHmac("sha256", secret()).update(`sim-access:${day}`).digest();
    return String(digest.readUInt32BE(0) % 1_000_000).padStart(6, "0");
}

export function currentAccessCode(at: Date = new Date()): string {
    return accessCodeForDay(accessCodeDay(at));
}

/**
 * First instant the code changes. Binary searched against the formatter rather
 * than assuming 24h, so DST transitions land on the right minute.
 */
export function nextRotation(at: Date = new Date()): Date {
    const today = accessCodeDay(at);
    let lo = at.getTime();
    let hi = lo + 26 * 60 * 60 * 1000;
    while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (accessCodeDay(new Date(mid)) === today) lo = mid;
        else hi = mid;
    }
    return new Date(hi);
}

export function formatRotationTime(at: Date): string {
    return timeFormat.format(at);
}

export function isValidAccessCode(provided: string, at: Date = new Date()): boolean {
    const cleaned = provided.replace(/\D/g, "");
    if (cleaned.length !== 6) return false;
    return timingSafeEqual(Buffer.from(cleaned), Buffer.from(currentAccessCode(at)));
}
