"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { WhitelistStatusBadge } from "@/components/minecraft/WhitelistStatusBadge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { WhitelistStatus } from "@/lib/db/schema";
import { formatDate } from "@/lib/utils";

export type AdminWhitelistRow = {
  id: number;
  username: string;
  status: WhitelistStatus;
  requesterName: string | null;
  requestNote: string | null;
  adminNote: string | null;
  addedDirectly: boolean;
  createdAt: Date;
};

export function WhitelistManager({
  requests,
}: {
  requests: AdminWhitelistRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [username, setUsername] = useState("");
  const [adding, setAdding] = useState(false);

  async function act(id: number, action: "approve" | "reject") {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/whitelist/${id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Action failed");
      }
      toast.success(`Request ${action}d`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function directAdd() {
    if (!username.trim()) {
      toast.error("Enter a username");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/admin/whitelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to add username");
      }
      toast.success("Username added to whitelist");
      setUsername("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Direct Add</CardTitle>
          <CardDescription>
            Add a username to the whitelist without a member request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="direct-username">Minecraft username</Label>
              <Input
                id="direct-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Notch"
                onKeyDown={(e) => {
                  if (e.key === "Enter") directAdd();
                }}
              />
            </div>
            <Button onClick={directAdd} disabled={adding}>
              {adding ? "Adding..." : "Add"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {requests.length === 0 ? (
        <div className="border-border text-muted-foreground rounded-lg border p-10 text-center">
          No whitelist requests yet.
        </div>
      ) : (
        <div className="border-border rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Requested by</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-foreground font-medium">
                    {r.username}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.requesterName ?? "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.addedDirectly ? "Direct add" : "Member request"}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-40 whitespace-normal">
                    {r.requestNote ?? r.adminNote ?? "-"}
                  </TableCell>
                  <TableCell>
                    <WhitelistStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(r.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.status === "pending" ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busy === r.id}
                          onClick={() => act(r.id, "reject")}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          disabled={busy === r.id}
                          onClick={() => act(r.id, "approve")}
                        >
                          Approve
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
