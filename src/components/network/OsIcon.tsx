import { CircleHelp, Smartphone } from "lucide-react";

import { AppleIcon, LinuxIcon, WindowsIcon } from "@/components/icons/os-icons";
import { cn } from "@/lib/utils";

export function OsIcon({ os, className }: { os: string; className?: string }) {
    const lower = os.toLowerCase();
    const cls = cn("size-4 shrink-0", className);
    if (lower.includes("mac") || lower.includes("darwin"))
        return <AppleIcon className={cn("text-foreground", cls)} />;
    if (lower.includes("ios") || lower.includes("android"))
        return <Smartphone className={cn("text-foreground", cls)} />;
    if (lower.includes("windows")) return <WindowsIcon className={cn("text-foreground", cls)} />;
    if (lower.includes("linux")) return <LinuxIcon className={cn("text-foreground", cls)} />;
    return <CircleHelp className={cn("text-muted-foreground", cls)} />;
}
