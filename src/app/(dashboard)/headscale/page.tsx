import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { JoinRequestForm } from "@/components/headscale/JoinRequestForm";
import { JoinRequestStatusBadge } from "@/components/headscale/JoinRequestStatusBadge";
import { NetworkStatusCard } from "@/components/headscale/NetworkStatusCard";
import { NodeList } from "@/components/headscale/NodeList";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { headscaleJoinRequest } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/session";
import { formatDate } from "@/lib/utils";

export default async function HeadscalePage() {
    const user = await getSessionUser();
    if (!user) redirect("/login");

    const requests = db
        .select({
            id: headscaleJoinRequest.id,
            deviceName: headscaleJoinRequest.deviceName,
            status: headscaleJoinRequest.status,
            adminNote: headscaleJoinRequest.adminNote,
            createdAt: headscaleJoinRequest.createdAt,
        })
        .from(headscaleJoinRequest)
        .where(eq(headscaleJoinRequest.userId, user.id))
        .orderBy(desc(headscaleJoinRequest.createdAt))
        .all();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl">Network</h1>
                <p className="text-muted-foreground">
                    TrickFire private network status and access.
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <NetworkStatusCard />

                <Card>
                    <CardHeader>
                        <CardTitle>Request Access</CardTitle>
                        <CardDescription>
                            Submit your device to request access to the TrickFire network.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <JoinRequestForm />
                    </CardContent>
                </Card>
            </div>

            <NodeList />

            <Card>
                <CardHeader>
                    <CardTitle>Your Requests</CardTitle>
                    <CardDescription>Status of access requests you have submitted.</CardDescription>
                </CardHeader>
                <CardContent>
                    {requests.length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                            You have not submitted any access requests yet.
                        </p>
                    ) : (
                        <ul className="divide-border divide-y">
                            {requests.map((r) => (
                                <li
                                    key={r.id}
                                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                                >
                                    <div>
                                        <p className="text-foreground font-medium">
                                            {r.deviceName}
                                        </p>
                                        <p className="text-muted-foreground text-xs">
                                            {formatDate(r.createdAt)}
                                            {r.adminNote ? ` · ${r.adminNote}` : ""}
                                        </p>
                                    </div>
                                    <JoinRequestStatusBadge status={r.status} />
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
