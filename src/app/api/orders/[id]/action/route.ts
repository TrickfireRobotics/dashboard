import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { order, orderHistory, user } from "@/lib/db/schema";
import {
    deductGiftFundForApproval,
    orderTotalCents,
    sendOrderApprovedEmail,
    sendOrderDeniedEmail,
    validateOrderBalance,
} from "@/lib/finance/finance";
import { getSessionUser } from "@/lib/auth/session";
import { ORDER_ACTION_STATUS, orderActionSchema } from "@/lib/validation";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (sessionUser.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const orderId = Number((await params).id);
    if (!Number.isInteger(orderId)) {
        return NextResponse.json({ error: "Invalid order id" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = orderActionSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid input", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const existing = db.select().from(order).where(eq(order.id, orderId)).get();
    if (!existing) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (existing.status !== "pending") {
        return NextResponse.json({ error: "Only pending orders can be reviewed" }, { status: 400 });
    }

    const newStatus = ORDER_ACTION_STATUS[parsed.data.action];
    const totalCostCents = orderTotalCents(existing.quantity, existing.unitCostCents);

    if (parsed.data.action === "approve") {
        const balanceCheck = validateOrderBalance(
            existing.fundType,
            existing.stfBucketId,
            totalCostCents
        );
        if (!balanceCheck.ok) {
            return NextResponse.json({ error: balanceCheck.message }, { status: 400 });
        }
    }

    const updated = db
        .update(order)
        .set({
            status: newStatus,
            denialComment:
                parsed.data.action === "deny" ? (parsed.data.denialComment ?? null) : null,
            reviewedBy: sessionUser.id,
            reviewedAt: new Date(),
        })
        .where(eq(order.id, orderId))
        .returning()
        .get();

    db.insert(orderHistory)
        .values({
            orderId,
            fromStatus: existing.status,
            toStatus: newStatus,
            changedBy: sessionUser.id,
            note: parsed.data.denialComment ?? null,
        })
        .run();

    if (parsed.data.action === "approve" && existing.fundType === "Gift") {
        deductGiftFundForApproval(orderId, totalCostCents, sessionUser.id);
    }

    const requester = db.select().from(user).where(eq(user.id, existing.userId)).get();
    if (requester?.email) {
        try {
            if (parsed.data.action === "approve") {
                await sendOrderApprovedEmail(requester.email, existing.itemName);
            } else {
                await sendOrderDeniedEmail(
                    requester.email,
                    existing.itemName,
                    parsed.data.denialComment
                );
            }
        } catch {
            // Email failure should not roll back the order action.
        }
    }

    return NextResponse.json({ order: updated });
}
