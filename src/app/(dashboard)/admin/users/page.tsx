import { and, asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { FeatureRequests, type FeatureRequestRow } from "@/components/admin/FeatureRequests";
import { PendingApprovals, type PendingUserRow } from "@/components/admin/PendingApprovals";
import { UserTable, type AdminUserRow } from "@/components/admin/UserTable";
import { db } from "@/lib/db";
import { user, userFeature } from "@/lib/db/schema";
import type { FeatureKey } from "@/lib/features";
import { getSessionUser } from "@/lib/session";

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
            role: user.role,
            isActive: user.isActive,
            canAccessVault: user.canAccessVault,
            createdAt: user.createdAt,
        })
        .from(user)
        .where(eq(user.approved, true))
        .orderBy(asc(user.name))
        .all();

    // Fetch granted features for each approved user
    const allFeatures = db
        .select({ userId: userFeature.userId, featureKey: userFeature.featureKey })
        .from(userFeature)
        .where(eq(userFeature.status, "granted"))
        .all();

    const featuresByUser = new Map<string, FeatureKey[]>();
    for (const f of allFeatures) {
        const list = featuresByUser.get(f.userId) ?? [];
        list.push(f.featureKey as FeatureKey);
        featuresByUser.set(f.userId, list);
    }

    const members: AdminUserRow[] = memberRows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role === "admin" ? "admin" : "member",
        isActive: u.isActive ?? true,
        canAccessVault: u.canAccessVault ?? false,
        grantedFeatures: featuresByUser.get(u.id) ?? [],
        createdAt: u.createdAt,
    }));

    // Pending feature requests
    const featureReqRows = db
        .select({
            id: userFeature.id,
            userId: userFeature.userId,
            featureKey: userFeature.featureKey,
            requestNote: userFeature.requestNote,
            requestedAt: userFeature.requestedAt,
            userName: user.name,
            userEmail: user.email,
        })
        .from(userFeature)
        .innerJoin(user, eq(userFeature.userId, user.id))
        .where(and(eq(userFeature.status, "pending"), eq(user.approved, true)))
        .orderBy(asc(userFeature.requestedAt))
        .all();

    const featureRequests: FeatureRequestRow[] = featureReqRows.map((r) => ({
        id: r.id,
        userId: r.userId,
        userName: r.userName,
        userEmail: r.userEmail,
        featureKey: r.featureKey,
        requestNote: r.requestNote,
        requestedAt: r.requestedAt,
    }));

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl">Users</h1>
                <p className="text-muted-foreground">
                    Manage member approvals, roles, and feature access.
                </p>
            </div>

            <PendingApprovals users={pendingUsers} />

            {featureRequests.length > 0 && <FeatureRequests requests={featureRequests} />}

            <div className="space-y-3">
                <h2 className="text-lg font-semibold">Members</h2>
                <UserTable users={members} currentUserId={current.id} />
            </div>
        </div>
    );
}
