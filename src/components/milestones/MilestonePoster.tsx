"use client";

import { toBlob } from "html-to-image";
import {
    Camera,
    CalendarDays,
    Database,
    FileCode2,
    GitCommitHorizontal,
    Loader2,
    type LucideIcon,
    Route,
    Users,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import type { MilestoneStats } from "@/lib/stats/milestones";

const numberFormat = new Intl.NumberFormat("en-US");
const dateFormat = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
});

function fmt(n: number): string {
    return numberFormat.format(n);
}

function downloadBlob(blob: Blob): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trickfire-milestones-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
    URL.revokeObjectURL(url);
}

type Tile = { icon: LucideIcon; value: string; label: string };

export function MilestonePoster({ stats }: { stats: MilestoneStats }) {
    const posterRef = useRef<HTMLDivElement>(null);
    const [isCapturing, setIsCapturing] = useState(false);

    const tiles = [
        stats.commitCount != null && {
            icon: GitCommitHorizontal,
            value: fmt(stats.commitCount),
            label: "Commits",
        },
        { icon: FileCode2, value: fmt(stats.fileCount), label: "TypeScript Files" },
        { icon: Route, value: fmt(stats.apiRouteCount), label: "API Routes" },
        { icon: Database, value: fmt(stats.dbTableCount), label: "Database Tables" },
        { icon: Users, value: fmt(stats.teamMemberCount), label: "Active Members" },
        stats.daysInDevelopment != null && {
            icon: CalendarDays,
            value: fmt(stats.daysInDevelopment),
            label: "Days In Development",
        },
    ].filter((tile): tile is Tile => Boolean(tile));

    function handleScreenshot() {
        const node = posterRef.current;
        if (!node) return;

        setIsCapturing(true);
        const blobPromise = toBlob(node, {
            pixelRatio: 2,
            backgroundColor: "#000000",
            width: node.scrollWidth,
            height: node.scrollHeight,
        }).then((blob) => {
            if (!blob) throw new Error("Could not render the poster to an image");
            return blob;
        });

        const canWriteImages =
            typeof navigator !== "undefined" &&
            "clipboard" in navigator &&
            typeof ClipboardItem !== "undefined";

        const result = canWriteImages
            ? navigator.clipboard
                  .write([new ClipboardItem({ "image/png": blobPromise })])
                  .then(() => toast.success("Copied poster to clipboard"))
            : blobPromise
                  .then(downloadBlob)
                  .then(() => toast.success("Clipboard isn't supported here - downloaded instead"));

        result
            .catch((err: unknown) => {
                toast.error(err instanceof Error ? err.message : "Screenshot failed");
            })
            .finally(() => setIsCapturing(false));
    }

    return (
        <>
            <button
                type="button"
                onClick={handleScreenshot}
                disabled={isCapturing}
                className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/60 fixed top-5 right-5 z-50 flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-medium tracking-widest uppercase backdrop-blur transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
                {isCapturing ? (
                    <Loader2 className="size-4 animate-spin" />
                ) : (
                    <Camera className="size-4" />
                )}
                {isCapturing ? "Capturing" : "Screenshot"}
            </button>

            <div ref={posterRef} className="h-full overflow-y-auto bg-black text-white">
                <div className="milestones-background relative min-h-full">
                    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col justify-center px-6 py-20 sm:px-14 lg:px-20">
                        <p className="text-primary/80 text-xs font-semibold tracking-[0.35em] uppercase sm:text-sm">
                            TrickFire Robotics // Dashboard
                        </p>
                        <p className="mt-3 text-6xl leading-none font-extrabold tracking-tight text-white sm:text-8xl">
                            MILESTONES
                            <span className="text-primary animate-pulse">_</span>
                        </p>
                        <p className="mt-4 text-base text-white/50 sm:text-lg">
                            The club&apos;s internal tools, measured in code.
                        </p>

                        <div className="mt-14 border-y border-white/10 py-10 sm:mt-20 sm:py-14">
                            <div className="text-primary text-7xl leading-none font-black tracking-tight [text-shadow:0_0_60px_rgba(0,254,0,0.35)] sm:text-9xl">
                                {fmt(stats.linesOfCode)}
                            </div>
                            <div className="mt-3 text-sm font-medium tracking-[0.25em] text-white/60 uppercase sm:text-xl">
                                Lines of TypeScript
                            </div>
                        </div>

                        <div className="mt-12 grid grid-cols-2 gap-4 sm:mt-16 sm:grid-cols-3 sm:gap-6">
                            {tiles.map((tile) => (
                                <div
                                    key={tile.label}
                                    className="rounded-xl border border-white/10 bg-white/3 p-5 sm:p-7"
                                >
                                    <tile.icon className="text-secondary mb-4 size-5 sm:size-6" />
                                    <div className="text-3xl font-bold sm:text-5xl">
                                        {tile.value}
                                    </div>
                                    <div className="mt-2 text-[0.65rem] tracking-[0.15em] text-white/50 uppercase sm:text-xs">
                                        {tile.label}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-14 flex items-center justify-between text-[0.65rem] tracking-[0.2em] text-white/35 uppercase sm:mt-20 sm:text-xs">
                            <span>dashboard.trickfirerobotics.com</span>
                            <span>Generated {dateFormat.format(new Date(stats.generatedAt))}</span>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
