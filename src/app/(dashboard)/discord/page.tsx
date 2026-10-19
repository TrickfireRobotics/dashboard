import { redirect } from "next/navigation";

import { DiscordBotConsole } from "@/components/discord/DiscordBotConsole";
import { getSessionUser } from "@/lib/auth/session";

export default async function DiscordBotPage() {
    const sessionUser = await getSessionUser();
    if (!sessionUser) redirect("/login");

    return <DiscordBotConsole />;
}
