import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { vaultEntry } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";
import { encryptSecret } from "@/lib/vault-crypto";
import { vaultEntryUpdateSchema } from "@/lib/validation";

async function requireAdmin() {
    const user = await getSessionUser();
    if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    if (user.role !== "admin")
        return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    return { user };
}

function parseId(raw: string) {
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const id = parseId((await params).id);
    if (id === null) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const existing = db.select().from(vaultEntry).where(eq(vaultEntry.id, id)).get();
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json().catch(() => null);
    const parsed = vaultEntryUpdateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid input", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const d = parsed.data;
    // Username only applies to login entries; ignore it for api_key entries.
    const allowUsername = existing.type === "login";

    const updated = db
        .update(vaultEntry)
        .set({
            ...(d.name !== undefined ? { name: d.name } : {}),
            ...(d.description !== undefined ? { description: d.description } : {}),
            ...(allowUsername && d.username !== undefined ? { username: d.username } : {}),
            ...(d.secret !== undefined ? { secret: encryptSecret(d.secret) } : {}),
            ...(d.easyCopy !== undefined ? { easyCopy: d.easyCopy } : {}),
        })
        .where(eq(vaultEntry.id, id))
        .returning({ id: vaultEntry.id })
        .get();

    return NextResponse.json({ id: updated.id });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const id = parseId((await params).id);
    if (id === null) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const deleted = db
        .delete(vaultEntry)
        .where(eq(vaultEntry.id, id))
        .returning({ id: vaultEntry.id })
        .get();
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ id: deleted.id });
}
