import { and, eq, inArray } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { order, orderHistory, user } from "@/lib/db/schema";
import {
    deductGiftFundForApproval,
    ensureFinanceSettingsRow,
    orderTotalCents,
    sendOrderApprovedEmail,
    sendOrderDeniedEmail,
    validateBatchBalance,
} from "@/lib/finance/finance";
import { getSessionUser } from "@/lib/auth/session";
import { ORDER_ACTION_STATUS, orderBulkActionSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const parsed = orderBulkActionSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid input", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const { orderIds, action, denialComment } = parsed.data;
    ensureFinanceSettingsRow();

    const targets = db
        .select()
        .from(order)
        .where(and(inArray(order.id, orderIds), eq(order.status, "pending")))
        .all();

    if (targets.length === 0) {
        return NextResponse.json({ error: "No pending orders in selection" }, { status: 400 });
    }

    if (action === "approve") {
        const untriaged = targets.filter((o) => !o.fundType);
        if (untriaged.length > 0) {
            return NextResponse.json(
                {
                    error: `Assign ${untriaged.length} order${untriaged.length === 1 ? "" : "s"} to a fund before approving.`,
                },
                { status: 400 }
            );
        }

        // Group by fund and bucket so each pool is checked against its own
        // balance with the whole selection counted at once.
        const groups = new Map<string, typeof targets>();
        for (const target of targets) {
            const key = `${target.fundType}:${target.stfBucketId ?? "none"}`;
            const group = groups.get(key);
            if (group) group.push(target);
            else groups.set(key, [target]);
        }

        for (const group of groups.values()) {
            const check = validateBatchBalance(group[0].fundType, group[0].stfBucketId, group);
            if (!check.ok) {
                return NextResponse.json({ error: check.message }, { status: 400 });
            }
        }
    }

    const newStatus = ORDER_ACTION_STATUS[action];
    const reviewedAt = new Date();

    for (const target of targets) {
        db.update(order)
            .set({
                status: newStatus,
                denialComment: action === "deny" ? (denialComment ?? null) : null,
                reviewedBy: sessionUser.id,
                reviewedAt,
            })
            .where(eq(order.id, target.id))
            .run();

        db.insert(orderHistory)
            .values({
                orderId: target.id,
                fromStatus: target.status,
                toStatus: newStatus,
                changedBy: sessionUser.id,
                note: denialComment ?? null,
            })
            .run();

        if (action === "approve" && target.fundType === "Gift") {
            deductGiftFundForApproval(
                target.id,
                orderTotalCents(target.quantity, target.unitCostCents, target.fundType),
                sessionUser.id
            );
        }
    }

    const requesters = new Map<string, string>();
    for (const target of targets) {
        if (requesters.has(target.userId)) continue;
        const requester = db.select().from(user).where(eq(user.id, target.userId)).get();
        if (requester?.email) requesters.set(target.userId, requester.email);
    }

    for (const target of targets) {
        const email = requesters.get(target.userId);
        if (!email) continue;
        try {
            if (action === "approve") {
                await sendOrderApprovedEmail(email, target.itemName);
            } else {
                await sendOrderDeniedEmail(email, target.itemName, denialComment);
            }
        } catch {
            // Email failure should not roll back the order action.
        }
    }

    return NextResponse.json({ count: targets.length, status: newStatus });
}
