import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";
import { updateUserSchema } from "@/lib/validation";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getSessionUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (admin.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = (await params).id;

  const body = await req.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // An admin cannot demote or deactivate themselves — avoids locking the club
  // out of its own admin panel.
  if (
    userId === admin.id &&
    (parsed.data.role === "member" || parsed.data.isActive === false)
  ) {
    return NextResponse.json(
      { error: "You cannot change your own role or active status" },
      { status: 400 },
    );
  }

  const existing = db.select().from(user).where(eq(user.id, userId)).get();
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const updated = db
    .update(user)
    .set({
      ...(parsed.data.role !== undefined ? { role: parsed.data.role } : {}),
      ...(parsed.data.isActive !== undefined
        ? { isActive: parsed.data.isActive }
        : {}),
    })
    .where(eq(user.id, userId))
    .returning({
      id: user.id,
      role: user.role,
      isActive: user.isActive,
    })
    .get();

  return NextResponse.json({ user: updated });
}
