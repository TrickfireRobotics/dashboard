"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";

export function TopNav({
  name,
  email,
  role,
}: {
  name: string;
  email: string;
  role: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
          router.refresh();
        },
        onError: () => setLoading(false),
      },
    });
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border px-6">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Signed in as</span>
        <span className="text-sm font-medium text-foreground">{name}</span>
        <Badge variant={role === "admin" ? "default" : "secondary"}>
          {role}
        </Badge>
      </div>
      <div className="flex items-center gap-4">
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {email}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSignOut}
          disabled={loading}
        >
          <LogOut className="size-4" />
          Sign out
        </Button>
      </div>
    </header>
  );
}
