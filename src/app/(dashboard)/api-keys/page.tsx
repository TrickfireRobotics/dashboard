import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { ApiKeyList, type ApiKeyRow } from "@/components/api-keys/ApiKeyList";
import { CreateKeyDialog } from "@/components/api-keys/CreateKeyDialog";
import { db } from "@/lib/db";
import { apiKey } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";

export default async function ApiKeysPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const keys: ApiKeyRow[] = db
    .select({
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      lastUsedAt: apiKey.lastUsedAt,
      isRevoked: apiKey.isRevoked,
      createdAt: apiKey.createdAt,
    })
    .from(apiKey)
    .where(eq(apiKey.userId, user.id))
    .orderBy(desc(apiKey.createdAt))
    .all();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl">API Keys</h1>
          <p className="text-muted-foreground">
            Keys authenticate your sim scripts against the portal.
          </p>
        </div>
        <CreateKeyDialog />
      </div>

      <ApiKeyList keys={keys} />
    </div>
  );
}
