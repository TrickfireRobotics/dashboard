import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { vaultEntry } from "@/lib/db/schema";
import { canReadVaultKey, getSessionUser } from "@/lib/session";
import { decryptSecret } from "@/lib/vault-crypto";

// Authenticated retrieval of an `api_key` vault secret. The key is never shipped
// in the page payload - it is decrypted on demand here for the logged-in user,
// and only if they hold a per-entry grant (or are an admin). See
// canReadVaultKey in lib/session.ts.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const entry = db
        .select({
            name: vaultEntry.name,
            type: vaultEntry.type,
            secret: vaultEntry.secret,
        })
        .from(vaultEntry)
        .where(eq(vaultEntry.id, id))
        .get();
    // 404 for both missing and non-api_key entries: login secrets are served by
    // the reveal endpoint, never here.
    if (!entry || entry.type !== "api_key") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!canReadVaultKey(user, id)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ name: entry.name, key: decryptSecret(entry.secret) });
}
