import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { ServerStatusCard } from "@/components/minecraft/ServerStatusCard";
import { WhitelistRequestForm } from "@/components/minecraft/WhitelistRequestForm";
import { WhitelistStatusBadge } from "@/components/minecraft/WhitelistStatusBadge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/lib/db";
import { minecraftWhitelist } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";
import { formatDate } from "@/lib/utils";

export default async function MinecraftPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const requests = db
    .select({
      id: minecraftWhitelist.id,
      username: minecraftWhitelist.username,
      status: minecraftWhitelist.status,
      adminNote: minecraftWhitelist.adminNote,
      createdAt: minecraftWhitelist.createdAt,
    })
    .from(minecraftWhitelist)
    .where(eq(minecraftWhitelist.userId, user.id))
    .orderBy(desc(minecraftWhitelist.createdAt))
    .all();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Minecraft</h1>
        <p className="text-muted-foreground">
          Club server status and whitelist requests.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ServerStatusCard />

        <Card>
          <CardHeader>
            <CardTitle>Request Whitelist</CardTitle>
            <CardDescription>
              Submit your Minecraft username to get access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WhitelistRequestForm />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Requests</CardTitle>
          <CardDescription>
            Status of whitelist requests you have submitted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              You have not requested whitelist access yet.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {requests.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-foreground font-medium">{r.username}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatDate(r.createdAt)}
                      {r.adminNote ? ` · ${r.adminNote}` : ""}
                    </p>
                  </div>
                  <WhitelistStatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
