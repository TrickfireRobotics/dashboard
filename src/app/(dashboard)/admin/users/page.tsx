import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { PendingApprovals, type PendingUserRow } from "@/components/admin/PendingApprovals";
import { UserTable, type AdminUserRow } from "@/components/admin/UserTable";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/session";

export default async function AdminUsersPage() {
    const current = await getSessionUser();
    if (!current) redirect("/login");

    // Pending approvals (unapproved users)
    const pendingRows = db
        .select({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt })
        .from(user)
        .where(eq(user.approved, false))
        .orderBy(asc(user.createdAt))
        .all();

    const pendingUsers: PendingUserRow[] = pendingRows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        createdAt: u.createdAt,
    }));

    // Approved members
    const memberRows = db
        .select({
            id: user.id,
            name: user.name,
            email: user.email,
            isActive: user.isActive,
            createdAt: user.createdAt,
        })
        .from(user)
        .where(eq(user.approved, true))
        .orderBy(asc(user.name))
        .all();

    const members: AdminUserRow[] = memberRows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        isActive: u.isActive ?? true,
        createdAt: u.createdAt,
    }));

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl">Users</h1>
                <p className="text-muted-foreground">Manage member approvals and account status.</p>
            </div>

            <PendingApprovals users={pendingUsers} />

            <div className="space-y-3">
                <h2 className="text-lg font-semibold">Members</h2>
                <UserTable users={members} currentUserId={current.id} />
            </div>
        </div>
    );
}
