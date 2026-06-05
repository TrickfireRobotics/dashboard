import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { user, vaultEntry, vaultEntryAccess } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";
import { vaultAccessSchema } from "@/lib/validation";

async function requireAdmin() {
    const sessionUser = await getSessionUser();
    if (!sessionUser)
        return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    if (sessionUser.role !== "admin")
        return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    return { user: sessionUser };
}

function parseId(raw: string) {
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
}

// Loads the entry and validates the request body. Only api_key entries support
// per-person grants - login entries are governed by the global vault toggle.
async function loadEntryAndBody(req: NextRequest, idRaw: string) {
    const id = parseId(idRaw);
    if (id === null) return { error: NextResponse.json({ error: "Invalid id" }, { status: 400 }) };

    const entry = db
        .select({ id: vaultEntry.id, type: vaultEntry.type })
        .from(vaultEntry)
        .where(eq(vaultEntry.id, id))
        .get();
    if (!entry) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
    if (entry.type !== "api_key") {
        return {
            error: NextResponse.json(
                { error: "Per-person access only applies to api_key entries" },
                { status: 400 }
            ),
        };
    }

    const body = await req.json().catch(() => null);
    const parsed = vaultAccessSchema.safeParse(body);
    if (!parsed.success) {
        return {
            error: NextResponse.json(
                { error: "Invalid input", issues: parsed.error.flatten() },
                { status: 400 }
            ),
        };
    }

    return { id, userId: parsed.data.userId };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const loaded = await loadEntryAndBody(req, (await params).id);
    if (loaded.error) return loaded.error;

    const target = db.select({ id: user.id }).from(user).where(eq(user.id, loaded.userId)).get();
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // The unique index makes a re-grant a no-op rather than an error.
    db.insert(vaultEntryAccess)
        .values({ entryId: loaded.id, userId: loaded.userId, grantedBy: auth.user.id })
        .onConflictDoNothing()
        .run();

    return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const loaded = await loadEntryAndBody(req, (await params).id);
    if (loaded.error) return loaded.error;

    db.delete(vaultEntryAccess)
        .where(
            and(
                eq(vaultEntryAccess.entryId, loaded.id),
                eq(vaultEntryAccess.userId, loaded.userId)
            )
        )
        .run();

    return NextResponse.json({ ok: true });
}
