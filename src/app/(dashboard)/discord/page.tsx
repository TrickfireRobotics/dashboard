import { Bot, Clock3 } from "lucide-react";
import { redirect } from "next/navigation";

import { DiscordBotConsole } from "@/components/discord/DiscordBotConsole";
import { getSessionUser } from "@/lib/auth/session";

export default async function DiscordBotPage() {
    const sessionUser = await getSessionUser();
    if (!sessionUser) redirect("/login");

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="text-primary mb-2 flex items-center gap-2 text-sm font-medium">
                        <Bot className="size-4" /> Discord operations
                    </div>
                    <h1 className="text-3xl sm:text-4xl">Bot console</h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        Gateway health, member activity, and a live view of the bot’s recent work.
                    </p>
                </div>
                <p className="text-muted-foreground flex items-center gap-2 text-xs">
                    <Clock3 className="size-3.5" /> Refreshes every 15 seconds
                </p>
            </div>
            <DiscordBotConsole />
        </div>
    );
}
