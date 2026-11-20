import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { vaultEntry } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";
import { decryptSecret } from "@/lib/security/vault-crypto";
import { getUnlockExpiry } from "@/lib/security/vault-unlock";

// Secrets never ship in the page payload - they are decrypted on demand here,
// and only while the vault is unlocked by a fresh password check.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Deactivated accounts keep a valid cookie until it expires, and /api/vault/*
    // isn't covered by the middleware's isActive check - so enforce it here.
    if (user.isActive === false) {
        return NextResponse.json({ error: "Account deactivated" }, { status: 403 });
    }

    const expiresAt = await getUnlockExpiry(user.id);
    if (expiresAt === null) {
        return NextResponse.json({ error: "Vault is locked", locked: true }, { status: 403 });
    }

    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const entry = db
        .select({ username: vaultEntry.username, secret: vaultEntry.secret })
        .from(vaultEntry)
        .where(eq(vaultEntry.id, id))
        .get();
    if (!entry) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Never let the cleartext secret be written to a browser or shared cache.
    return NextResponse.json(
        { username: entry.username, secret: decryptSecret(entry.secret), expiresAt },
        { headers: { "Cache-Control": "no-store" } }
    );
}
