import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { order } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";
import { ORDER_ACTION_STATUS, orderActionSchema } from "@/lib/validation";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin") {
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

    const updated = db
        .update(order)
        .set({
            status: ORDER_ACTION_STATUS[parsed.data.action],
            adminNote: parsed.data.adminNote ?? null,
            reviewedBy: user.id,
            reviewedAt: new Date(),
        })
        .where(eq(order.id, orderId))
        .returning()
        .get();

    return NextResponse.json({ order: updated });
}
