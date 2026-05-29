import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { minecraftWhitelist } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";
import { whitelistDirectAddSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const admin = await getSessionUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (admin.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = whitelistDirectAddSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const created = db
    .insert(minecraftWhitelist)
    .values({
      userId: null,
      username: parsed.data.username,
      status: "approved",
      adminNote: parsed.data.adminNote ?? null,
      addedDirectly: true,
      reviewedBy: admin.id,
      reviewedAt: new Date(),
    })
    .returning()
    .get();

  return NextResponse.json({ request: created }, { status: 201 });
}
