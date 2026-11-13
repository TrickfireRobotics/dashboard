import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { order, stfBucket, user as userTable } from "@/lib/db/schema";
import { ensureFinanceSettingsRow, getOrderPricingSettings } from "@/lib/finance/finance";
import { buildOrderingSheetWorkbook } from "@/lib/finance/order-workbook";

// Always-current replacement for hand-copying approved orders into the
// Ordering_Sheet tab: regenerates the workbook from the live order table on
// every request, so whoever downloads it never gets a stale copy.
export async function GET() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    ensureFinanceSettingsRow();
    const pricing = getOrderPricingSettings();

    const orders = db
        .select({
            itemName: order.itemName,
            fundType: order.fundType,
            stfBucketName: stfBucket.name,
            quantity: order.quantity,
            unitCostCents: order.unitCostCents,
            vendor: order.vendor,
            link: order.link,
            notes: order.notes,
            partNumber: order.partNumber,
            createdAt: order.createdAt,
            status: order.status,
            requesterName: userTable.name,
            requesterEmail: userTable.email,
        })
        .from(order)
        .leftJoin(stfBucket, eq(order.stfBucketId, stfBucket.id))
        .leftJoin(userTable, eq(order.userId, userTable.id))
        .orderBy(desc(order.createdAt))
        .all();

    const workbook = buildOrderingSheetWorkbook(orders, pricing);

    return new NextResponse(new Blob([Uint8Array.from(workbook)]), {
        headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Length": String(workbook.length),
            "Content-Disposition": 'attachment; filename="Ordering_Sheet.xlsx"',
        },
    });
}
