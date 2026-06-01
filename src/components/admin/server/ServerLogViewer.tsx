"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const BRACKET_COLORS = [
    "text-cyan-300",
    "text-amber-300",
    "text-lime-300",
    "text-fuchsia-300",
    "text-sky-300",
    "text-rose-300",
];

const COMMANDS = [
    "stop",
    "op <player>",
    "deop <player>",
    "kick <player> [reason]",
    "ban <player> [reason]",
    "ban-ip <ip> [reason]",
    "pardon <player>",
    "pardon-ip <ip>",
    "whitelist add <player>",
    "whitelist remove <player>",
    "whitelist list",
    "whitelist on",
    "whitelist off",
    "whitelist reload",
    "time set day",
    "time set night",
    "time set noon",
    "time add <amount>",
    "weather clear",
    "weather rain",
    "weather thunder",
    "gamemode survival <player>",
    "gamemode creative <player>",
    "gamemode adventure <player>",
    "gamemode spectator <player>",
    "give <player> <item> [count]",
    "tp <player> <target>",
    "kill <target>",
    "say <message>",
    "tell <player> <message>",
    "list",
    "difficulty peaceful",
    "difficulty easy",
    "difficulty normal",
    "difficulty hard",
    "seed",
    "save-all",
    "save-on",
    "save-off",
    "reload",
    "gamerule keepInventory true",
    "gamerule keepInventory false",
    "gamerule doFireTick false",
    "gamerule doFireTick true",
    "gamerule mobGriefing false",
    "gamerule mobGriefing true",
    "gamerule doMobSpawning false",
    "gamerule doMobSpawning true",
    "effect give <player> <effect>",
    "effect clear <player>",
    "xp add <player> <amount>",
    "title <player> title <text>",
    "worldborder set <size>",
    "worldborder center <x> <z>",
    "locate structure <structure>",
    "summon <entity>",
    "setblock <x> <y> <z> <block>",
    "fill <x1> <y1> <z1> <x2> <y2> <z2> <block>",
    "scoreboard objectives list",
    "scoreboard players list",
    "team list",
];

export function ServerLogViewer() {
    const [lines, setLines] = useState<string[]>([]);
    const [cmd, setCmd] = useState("");
    const [sending, setSending] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
    const logRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const atBottomRef = useRef(true);

    useEffect(() => {
        const sse = new EventSource("/api/admin/server/logs");
        sse.onmessage = (e) => {
            const payload = JSON.parse(e.data) as
                | { type: "line"; line: string }
                | { type: "reset" };
            if (payload.type === "reset") {
                setLines([]);
                return;
            }
            setLines((prev) => [...prev.slice(-999), payload.line]);
        };
        sse.onerror = () => {
            setTimeout(() => {}, 0);
        };
        return () => sse.close();
    }, []);

    useEffect(() => {
        const el = logRef.current;
        if (!el) return;
        if (atBottomRef.current) {
            el.scrollTop = el.scrollHeight;
        }
    }, [lines]);

    function onScroll() {
        const el = logRef.current;
        if (!el) return;
        atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    }

    function onCmdChange(value: string) {
        setCmd(value);
        setSelectedSuggestion(-1);
        if (!value.trim()) {
            setSuggestions([]);
            return;
        }
        const lower = value.toLowerCase();
        setSuggestions(COMMANDS.filter((c) => c.toLowerCase().startsWith(lower)).slice(0, 8));
    }

    function applySuggestion(s: string) {
        setCmd(s);
        setSuggestions([]);
        setSelectedSuggestion(-1);
        inputRef.current?.focus();
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (suggestions.length === 0) {
            if (e.key === "Enter") sendCmd();
            return;
        }
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedSuggestion((i) => Math.min(i + 1, suggestions.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedSuggestion((i) => Math.max(i - 1, -1));
        } else if (e.key === "Tab") {
            e.preventDefault();
            const idx = selectedSuggestion >= 0 ? selectedSuggestion : 0;
            applySuggestion(suggestions[idx]);
        } else if (e.key === "Enter") {
            if (selectedSuggestion >= 0) {
                e.preventDefault();
                applySuggestion(suggestions[selectedSuggestion]);
            } else {
                sendCmd();
            }
        } else if (e.key === "Escape") {
            setSuggestions([]);
            setSelectedSuggestion(-1);
        }
    }

    async function sendCmd() {
        const command = cmd.trim();
        if (!command) return;
        setSending(true);
        try {
            const res = await fetch("/api/admin/server/command", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ command }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error ?? "Failed to send command");
            setCmd("");
            setSuggestions([]);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setSending(false);
        }
    }

    function renderLogLine(line: string) {
        if (/^>\s?/.test(line)) {
            const command = line.replace(/^>\s?/, "");
            return (
                <>
                    <span className="text-emerald-300">&gt; </span>
                    <span className="text-emerald-200">{command}</span>
                </>
            );
        }

        const pieces: Array<{ text: string; bracketIndex: number | null }> = [];
        const bracketRegex = /\[[^\]]*\]/g;
        let last = 0;
        let bracketIndex = 0;

        for (const match of line.matchAll(bracketRegex)) {
            const start = match.index ?? 0;
            if (start > last) {
                pieces.push({ text: line.slice(last, start), bracketIndex: null });
            }
            pieces.push({ text: match[0], bracketIndex });
            bracketIndex += 1;
            last = start + match[0].length;
        }

        if (last < line.length) {
            pieces.push({ text: line.slice(last), bracketIndex: null });
        }

        if (pieces.length === 0) {
            return <>{line}</>;
        }

        return (
            <>
                {pieces.map((piece, idx) => {
                    if (piece.bracketIndex === null) {
                        return <span key={idx}>{piece.text}</span>;
                    }
                    const color = BRACKET_COLORS[piece.bracketIndex % BRACKET_COLORS.length];
                    return (
                        <span key={idx} className={color}>
                            {piece.text}
                        </span>
                    );
                })}
            </>
        );
    }

    return (
        <Card className="flex flex-1 flex-col">
            <CardHeader>
                <CardTitle>Server Log</CardTitle>
                <CardDescription>Live output from the server process.</CardDescription>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
                <div
                    ref={logRef}
                    onScroll={onScroll}
                    className="bg-muted/40 min-h-0 flex-1 overflow-y-auto rounded-md p-3 font-mono text-xs leading-relaxed"
                >
                    {lines.length === 0 ? (
                        <span className="text-muted-foreground">No output yet.</span>
                    ) : (
                        lines.map((l, i) => (
                            <div key={i} className="break-all whitespace-pre-wrap">
                                {renderLogLine(l)}
                            </div>
                        ))
                    )}
                </div>

                <div className="relative">
                    {suggestions.length > 0 && (
                        <div className="border-border bg-popover absolute right-0 bottom-full left-0 mb-1 rounded-md border shadow-md">
                            {suggestions.map((s, i) => (
                                <button
                                    key={s}
                                    type="button"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        applySuggestion(s);
                                    }}
                                    className={`w-full px-3 py-1.5 text-left font-mono text-xs transition-colors ${
                                        i === selectedSuggestion
                                            ? "bg-accent text-accent-foreground"
                                            : "hover:bg-accent/60"
                                    }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="flex gap-2">
                        <Input
                            ref={inputRef}
                            value={cmd}
                            onChange={(e) => onCmdChange(e.target.value)}
                            onKeyDown={onKeyDown}
                            placeholder="Your next amazing command"
                            className="font-mono text-sm"
                            disabled={sending}
                            autoComplete="off"
                            spellCheck={false}
                        />
                        <Button onClick={sendCmd} disabled={sending || !cmd.trim()}>
                            Send
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
