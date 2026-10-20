import { randomInt, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { simAccessCode } from "@/lib/db/schema";

// One 6-digit code, club-wide, is all the sim CLI needs to pull a model from
// OnShape through the dashboard. It rotates on its own at 3am Pacific and can
// be rotated early from the API Keys page. Stored rather than derived so that
// an early rotation really does invalidate the old code.

const TIMEZONE = "America/Los_Angeles";
const ROTATION_HOUR = 3;
const ROW_ID = 1;

const stampFormat = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
});

const clockFormat = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
});

/** Local wall clock as a sortable "YYYY-MM-DD hh:mm:ss" string. */
function localStamp(at: Date): string {
    const p = Object.fromEntries(
        stampFormat.formatToParts(at).map((part) => [part.type, part.value])
    );
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

function rotationStampAfter(stamp: string): string {
    const [day, clock] = stamp.split(" ") as [string, string];
    const target = String(ROTATION_HOUR).padStart(2, "0") + ":00:00";
    if (clock < target) return `${day} ${target}`;

    const [y, m, d] = day.split("-").map(Number) as [number, number, number];
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    return `${next.toISOString().slice(0, 10)} ${target}`;
}

/**
 * The next 3am Pacific strictly after `at`. Binary searched against the
 * formatter instead of adding 24h, so the DST weekends land on 3am too.
 */
export function nextRotation(at: Date = new Date()): Date {
    const target = rotationStampAfter(localStamp(at));
    let lo = at.getTime();
    let hi = lo + 50 * 60 * 60 * 1000;
    while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (localStamp(new Date(mid)) < target) lo = mid;
        else hi = mid;
    }
    return new Date(hi);
}

export function formatRotationTime(at: Date): string {
    return clockFormat.format(at);
}

function generateCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export type AccessCode = { code: string; rotatesAt: Date };

function issue(now: Date, rotatedBy: string | null): AccessCode {
    const row = {
        id: ROW_ID,
        code: generateCode(),
        rotatesAt: nextRotation(now),
        rotatedBy,
        createdAt: now,
    };
    db.insert(simAccessCode)
        .values(row)
        .onConflictDoUpdate({ target: simAccessCode.id, set: row })
        .run();
    return { code: row.code, rotatesAt: row.rotatesAt };
}

/**
 * Current code, rotating it first if 3am has passed since it was issued. Every
 * read goes through here, so the code is never stale even if the server was
 * asleep at 3am.
 */
export function getAccessCode(now: Date = new Date()): AccessCode {
    const row = db.select().from(simAccessCode).where(eq(simAccessCode.id, ROW_ID)).get();
    if (!row || row.rotatesAt.getTime() <= now.getTime()) {
        return issue(now, null);
    }
    return { code: row.code, rotatesAt: row.rotatesAt };
}

/** Rotate early. Invalidates the old code immediately. */
export function rotateAccessCode(rotatedBy: string | null, now: Date = new Date()): AccessCode {
    return issue(now, rotatedBy);
}

export function isValidAccessCode(provided: string, now: Date = new Date()): boolean {
    const cleaned = provided.replace(/\D/g, "");
    if (cleaned.length !== 6) return false;
    return timingSafeEqual(Buffer.from(cleaned), Buffer.from(getAccessCode(now).code));
}
