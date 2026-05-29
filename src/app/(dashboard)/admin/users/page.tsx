import { asc } from "drizzle-orm";
import { redirect } from "next/navigation";

import { UserTable, type AdminUserRow } from "@/components/admin/UserTable";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";

export default async function AdminUsersPage() {
  const current = await getSessionUser();
  if (!current) redirect("/login");

  const rows = db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(asc(user.name))
    .all();

  const users: AdminUserRow[] = rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role === "admin" ? "admin" : "member",
    isActive: u.isActive ?? true,
    createdAt: u.createdAt,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Users</h1>
        <p className="text-muted-foreground">
          Manage member roles and access.
        </p>
      </div>

      <UserTable users={users} currentUserId={current.id} />
    </div>
  );
}
