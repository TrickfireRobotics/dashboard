import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { order } from "@/lib/db/schema";
import { getActiveQuarter, orderTotalCents, validateOrderBalance } from "@/lib/finance";
import { getSessionUser } from "@/lib/session";
import { orderInputSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
            { error: "No active STF school year is configured. Contact an officer." },
            { status: 400 }
        );
    }

    const created = db
        .insert(order)
        .values({
            userId: user.id,
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
        })
        .returning()
        .get();

    return NextResponse.json({ order: created }, { status: 201 });
}
