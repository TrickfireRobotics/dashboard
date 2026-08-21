import { randomUUID } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { order } from "@/lib/db/schema";
import { ensureFinanceSettingsRow } from "@/lib/finance/finance";
import { getSessionUser } from "@/lib/auth/session";
import { orderBatchInputSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const parsed = orderBatchInputSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid input", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    ensureFinanceSettingsRow();

    // Orders arrive untriaged: no fund type, bucket or quarter. An officer
    // assigns those later, and the balance check runs at that point.
    const batchId = parsed.data.items.length > 1 ? randomUUID() : null;
    const rows = parsed.data.items.map((item) => ({
        userId: user.id,
        batchId,
        vendor: item.vendor,
        link: item.link,
        itemName: item.itemName,
        partNumber: item.partNumber?.trim() || null,
        quantity: item.quantity,
        unitCostCents: Math.round(item.unitCost * 100),
        notes: item.notes?.trim() || null,
    }));

    const created = db.insert(order).values(rows).returning().all();

    return NextResponse.json({ orders: created, count: created.length }, { status: 201 });
}
