"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AzaleaConfig } from "@/lib/azalea";

function EditField({
    label,
    value,
    onChange,
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
}) {
    return (
        <div className="space-y-1.5">
            <Label>{label}</Label>
            <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="font-mono text-sm"
            />
        </div>
    );
}

function ArrayField({
    label,
    items,
    onChange,
}: {
    label: string;
    items: string[];
    onChange: (v: string[]) => void;
}) {
    const [newItem, setNewItem] = useState("");

    function add() {
        const val = newItem.trim();
        if (!val) return;
        onChange([...items, val]);
        setNewItem("");
    }

    return (
        <div className="space-y-1.5">
            <Label>{label}</Label>
            <div className="space-y-1">
                {items.map((item, i) => (
                    <div key={i} className="flex gap-2">
                        <Input
                            value={item}
                            onChange={(e) => {
                                const next = [...items];
                                next[i] = e.target.value;
                                onChange(next);
                            }}
                            className="font-mono text-sm"
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => onChange(items.filter((_, j) => j !== i))}
                        >
                            <Trash2 className="size-4" />
                        </Button>
                    </div>
                ))}
                <div className="flex gap-2">
                    <Input
                        value={newItem}
                        onChange={(e) => setNewItem(e.target.value)}
                        placeholder="Add item…"
                        className="font-mono text-sm"
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                add();
                            }
                        }}
                    />
                    <Button type="button" variant="outline" size="icon" onClick={add}>
                        <Plus className="size-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

export function RunSettingsCard({ initial }: { initial: AzaleaConfig }) {
    const [run, setRun] = useState(initial.run);
    const [saving, setSaving] = useState(false);

    function setField<K extends keyof AzaleaConfig["run"]>(
        key: K,
        value: AzaleaConfig["run"][K]
    ) {
        setRun((r) => ({ ...r, [key]: value }));
    }

    async function save() {
        setSaving(true);
        try {
            const res = await fetch("/api/admin/server/config", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...initial, run }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error ?? "Save failed");
            toast.success("Run settings saved");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setSaving(false);
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Run Settings</CardTitle>
                <CardDescription>Applied on the next server start.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-3 grid-cols-1">
                    <EditField
                        label="RAM"
                        value={run.ram}
                        onChange={(v) => setField("ram", v)}
                        placeholder="4G"
                    />
                    <EditField
                        label="Java binary"
                        value={run.java_bin}
                        onChange={(v) => setField("java_bin", v)}
                        placeholder="java"
                    />
                    <EditField
                        label="Jar name"
                        value={run.jar_name}
                        onChange={(v) => setField("jar_name", v)}
                        placeholder="server.jar"
                    />
                </div>
                <ArrayField
                    label="JVM args"
                    items={run.jvm_args}
                    onChange={(v) => setField("jvm_args", v)}
                />
                <ArrayField
                    label="Game args"
                    items={run.game_args}
                    onChange={(v) => setField("game_args", v)}
                />
                <div className="flex justify-end pt-1">
                    <Button onClick={save} disabled={saving}>
                        {saving ? "Saving…" : "Save"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
