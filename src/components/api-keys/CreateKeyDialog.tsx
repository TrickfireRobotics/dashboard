"use client";

import { Check, Copy, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateKeyDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setName("");
    setSubmitting(false);
    setCreatedKey(null);
    setCopied(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      reset();
      if (createdKey) router.refresh();
    }
  }

  async function createKey() {
    if (!name.trim()) {
      toast.error("Give the key a name");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to create key");
      setCreatedKey(data.key as string);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyKey() {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button>
            <KeyRound className="size-4" />
            Create key
          </Button>
        }
      />
      <DialogContent>
        {createdKey ? (
          <>
            <DialogHeader>
              <DialogTitle>Copy your API key</DialogTitle>
              <DialogDescription>
                This is the only time the key will be shown. Store it somewhere
                safe.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
                {createdKey}
              </code>
              <Button size="icon" variant="outline" onClick={copyKey}>
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>New API key</DialogTitle>
              <DialogDescription>
                Name the key so you can recognise it later.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="key-name">Key name</Label>
              <Input
                id="key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. sim-laptop"
                onKeyDown={(e) => {
                  if (e.key === "Enter") createKey();
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button onClick={createKey} disabled={submitting}>
                {submitting ? "Creating..." : "Create"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
