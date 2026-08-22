import { and, eq, inArray } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { order } from "@/lib/db/schema";
import {
    assignOrdersToFund,
    ensureFinanceSettingsRow,
    getActiveQuarter,
    validateAssignmentBalance,
} from "@/lib/finance/finance";
import { getSessionUser } from "@/lib/auth/session";
import { orderAssignSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const parsed = orderAssignSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid input", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const { orderIds, fundType, stfBucketId } = parsed.data;
    ensureFinanceSettingsRow();

    if (fundType === "STF" && !getActiveQuarter()) {
        return NextResponse.json(
            { error: "No active STF school year is configured." },
            { status: 400 }
        );
    }

    const targets = db
        .select()
        .from(order)
        .where(and(inArray(order.id, orderIds), eq(order.status, "pending")))
        .all();

    if (targets.length !== orderIds.length) {
        return NextResponse.json(
            { error: "Only pending orders can be assigned to a fund." },
            { status: 400 }
        );
    }

    // Assigning does not spend the fund, but block parking more in a bucket
    // than it can cover so the approval step is not a dead end.
    const balanceCheck = validateAssignmentBalance(
        fundType,
        stfBucketId ?? null,
        orderIds,
        targets
    );
    if (!balanceCheck.ok) {
        return NextResponse.json({ error: balanceCheck.message }, { status: 400 });
    }

    const assignedCount = assignOrdersToFund(
        orderIds,
        fundType,
        stfBucketId ?? null,
        sessionUser.id
    );

    return NextResponse.json({ assignedCount });
}
