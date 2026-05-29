import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { apiKey } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keyId = Number((await params).id);
  if (!Number.isInteger(keyId)) {
    return NextResponse.json({ error: "Invalid key id" }, { status: 400 });
  }

  const revoked = db
    .update(apiKey)
    .set({ isRevoked: true })
    .where(and(eq(apiKey.id, keyId), eq(apiKey.userId, user.id)))
    .returning({ id: apiKey.id })
    .get();

  if (!revoked) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }

  return NextResponse.json({ id: revoked.id });
}
