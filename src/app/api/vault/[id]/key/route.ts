import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { vaultEntry } from "@/lib/db/schema";
import { canReadVaultEntry, getSessionUser } from "@/lib/session";
import { decryptSecret } from "@/lib/vault-crypto";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.isActive === false) {
        return NextResponse.json({ error: "Account deactivated" }, { status: 403 });
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
    if (!entry || entry.type !== "api_key") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!canReadVaultEntry(user, id)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
        { name: entry.name, key: decryptSecret(entry.secret) },
        { headers: { "Cache-Control": "no-store" } }
    );
}
