import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { vaultEntry } from "@/lib/db/schema";
import { canUseVault, getSessionUser } from "@/lib/session";
import { decryptSecret } from "@/lib/vault-crypto";

// Secrets never ship in the page payload - they are decrypted on demand here,
// only for users who currently hold vault access.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canUseVault(user)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const entry = db
        .select({
            type: vaultEntry.type,
            username: vaultEntry.username,
            secret: vaultEntry.secret,
        })
        .from(vaultEntry)
        .where(eq(vaultEntry.id, id))
        .get();
    if (!entry) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
        username: entry.type === "login" ? entry.username : null,
        secret: decryptSecret(entry.secret),
    });
}
