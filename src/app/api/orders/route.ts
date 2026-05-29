import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { order } from "@/lib/db/schema";
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
  const created = db
    .insert(order)
    .values({
      userId: user.id,
      teamId: d.teamId ?? null,
      itemName: d.itemName,
      vendorUrl: d.vendorUrl ?? null,
      description: d.description ?? null,
      partType: d.partType ?? null,
      partNumber: d.partNumber ?? null,
      quantity: d.quantity,
      unitPrice: d.unitPrice != null ? Math.round(d.unitPrice * 100) : null,
    })
    .returning()
    .get();

  return NextResponse.json({ order: created }, { status: 201 });
}
