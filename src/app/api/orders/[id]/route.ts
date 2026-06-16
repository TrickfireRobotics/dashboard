import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { order, orderHistory } from "@/lib/db/schema";
import { getActiveQuarter, orderTotalCents, validateOrderBalance } from "@/lib/finance";
import { getSessionUser } from "@/lib/session";
import { orderInputSchema } from "@/lib/validation";

function parseOrderId(params: { id: string }) {
    const orderId = Number(params.id);
    if (!Number.isInteger(orderId)) return null;
    return orderId;
}

function memberCanModifyOrder(existing: { userId: string; status: string }, userId: string) {
    return existing.userId === userId && existing.status !== "approved";
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orderId = parseOrderId(await params);
    if (orderId == null) {
        return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
    }

    const existing = db.select().from(order).where(eq(order.id, orderId)).get();
    if (!existing) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (!memberCanModifyOrder(existing, user.id)) {
        return NextResponse.json({ error: "This order cannot be edited" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const parsed = orderInputSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid input", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const d = parsed.data;
    const unitCostCents = Math.round(d.unitCost * 100);
    const totalCostCents = orderTotalCents(d.quantity, unitCostCents);

    const balanceCheck = validateOrderBalance(d.fundType, d.stfBucketId, totalCostCents);
    if (!balanceCheck.ok) {
        return NextResponse.json({ error: balanceCheck.message }, { status: 400 });
    }

    const activeQuarter = d.fundType === "STF" ? getActiveQuarter() : null;
    if (d.fundType === "STF" && !activeQuarter) {
        return NextResponse.json(
            { error: "No active STF quarter is configured. Contact an officer." },
            { status: 400 }
        );
    }

    const updated = db
        .update(order)
        .set({
            fundType: d.fundType,
            stfBucketId: d.fundType === "STF" ? d.stfBucketId! : null,
            quarterId: activeQuarter?.id ?? null,
            vendor: d.vendor,
            link: d.link,
            itemName: d.itemName,
            partNumber: d.partNumber?.trim() || null,
            quantity: d.quantity,
            unitCostCents,
            notes: d.notes?.trim() || null,
            status: "pending",
            denialComment: null,
            reviewedBy: null,
            reviewedAt: null,
        })
        .where(eq(order.id, orderId))
        .returning()
        .get();

    db.insert(orderHistory)
        .values({
            orderId,
            fromStatus: existing.status,
            toStatus: "pending",
            changedBy: user.id,
            note: existing.status === "denied" ? "Resubmitted by requester" : "Edited by requester",
        })
        .run();

    return NextResponse.json({ order: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orderId = parseOrderId(await params);
    if (orderId == null) {
        return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
    }

    const existing = db.select().from(order).where(eq(order.id, orderId)).get();
    if (!existing) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (!memberCanModifyOrder(existing, user.id)) {
        return NextResponse.json({ error: "This order cannot be deleted" }, { status: 403 });
    }

    db.delete(order).where(eq(order.id, orderId)).run();

    return new NextResponse(null, { status: 204 });
}
