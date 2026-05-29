import { asc, desc, eq, sql } from "drizzle-orm";

import {
  WhitelistManager,
  type AdminWhitelistRow,
} from "@/components/admin/WhitelistManager";
import { db } from "@/lib/db";
import { minecraftWhitelist, user } from "@/lib/db/schema";

export default async function AdminMinecraftPage() {
  const rows = db
    .select({
      id: minecraftWhitelist.id,
      username: minecraftWhitelist.username,
      status: minecraftWhitelist.status,
      requesterName: user.name,
      requestNote: minecraftWhitelist.requestNote,
      adminNote: minecraftWhitelist.adminNote,
      addedDirectly: minecraftWhitelist.addedDirectly,
      createdAt: minecraftWhitelist.createdAt,
    })
    .from(minecraftWhitelist)
    .leftJoin(user, eq(minecraftWhitelist.userId, user.id))
    .orderBy(
      asc(
        sql`case when ${minecraftWhitelist.status} = 'pending' then 0 else 1 end`,
      ),
      desc(minecraftWhitelist.createdAt),
    )
    .all();

  const requests: AdminWhitelistRow[] = rows.map((r) => ({
    ...r,
    requesterName: r.requesterName ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Whitelist</h1>
        <p className="text-muted-foreground">
          Review whitelist requests and add usernames directly.
        </p>
      </div>

      <WhitelistManager requests={requests} />
    </div>
  );
}
