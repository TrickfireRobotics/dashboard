import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { FeaturesPanel } from "@/components/features/FeaturesPanel";
import { db } from "@/lib/db";
import { userFeature } from "@/lib/db/schema";
import { FEATURE_KEYS, FEATURES, type FeatureKey } from "@/lib/features";
import { getSessionUser } from "@/lib/auth/session";

export default async function FeaturesPage({
    searchParams,
}: {
    searchParams: Promise<{ denied?: string }>;
}) {
    const user = await getSessionUser();
    if (!user) redirect("/login");

    const isAdmin = user.role === "admin";

    const features = isAdmin
        ? FEATURE_KEYS.map((key) => ({
              key,
              label: FEATURES[key].label,
              description: FEATURES[key].description,
              status: "granted" as const,
          }))
        : (() => {
              const rows = db
                  .select({ featureKey: userFeature.featureKey, status: userFeature.status })
                  .from(userFeature)
                  .where(eq(userFeature.userId, user.id))
                  .all();
              const statusMap = Object.fromEntries(
                  rows.map((r) => [r.featureKey, r.status])
              ) as Record<FeatureKey, "pending" | "granted" | "rejected" | undefined>;
              return FEATURE_KEYS.map((key) => ({
                  key,
                  label: FEATURES[key].label,
                  description: FEATURES[key].description,
                  status: statusMap[key] ?? null,
              }));
          })();

    const { denied } = await searchParams;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl">My Access</h1>
                <p className="text-muted-foreground">
                    {isAdmin
                        ? "Admins have full access to all features."
                        : "Request access to features. An admin will review and approve your requests."}
                </p>
            </div>
            <FeaturesPanel features={features} deniedKey={isAdmin ? null : (denied ?? null)} />
        </div>
    );
}
