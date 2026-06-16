import * as Sentry from "@sentry/nextjs";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userFeature } from "@/lib/db/schema";
import type { FeatureKey } from "@/lib/features";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user || session.user.isActive === false) {
        redirect("/login");
    }
    if (!session.user.approved) {
        redirect("/pending");
    }

    Sentry.setUser({ id: session.user.id, email: session.user.email });

    const isAdmin = session.user.role === "admin";
    const canAccessVault = isAdmin || session.user.canAccessVault === true;

    const grantedFeatures: FeatureKey[] = isAdmin
        ? ["orders", "api-keys", "minecraft", "network"]
        : db
              .select({ featureKey: userFeature.featureKey })
              .from(userFeature)
              .where(
                  and(eq(userFeature.userId, session.user.id), eq(userFeature.status, "granted"))
              )
              .all()
              .map((r) => r.featureKey as FeatureKey);

    return (
        <div className="flex h-full overflow-hidden">
            <Sidebar
                isAdmin={isAdmin}
                canAccessVault={canAccessVault}
                name={session.user.name}
                email={session.user.email}
                grantedFeatures={grantedFeatures}
            />
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <TopNav
                    isAdmin={isAdmin}
                    canAccessVault={canAccessVault}
                    name={session.user.name}
                    email={session.user.email}
                    grantedFeatures={grantedFeatures}
                />
                <main className="flex-1 overflow-y-auto p-6">{children}</main>
            </div>
        </div>
    );
}
