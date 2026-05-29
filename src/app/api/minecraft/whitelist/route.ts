import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { minecraftWhitelist } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";
import { whitelistRequestSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = whitelistRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const created = db
    .insert(minecraftWhitelist)
    .values({
      userId: user.id,
      username: parsed.data.username,
      requestNote: parsed.data.requestNote ?? null,
    })
    .returning()
    .get();

  return NextResponse.json({ request: created }, { status: 201 });
}
