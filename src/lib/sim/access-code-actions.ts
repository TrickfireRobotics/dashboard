"use server";

import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";
import { rotateAccessCode } from "./access-code";

export async function rotateSimAccessCode(): Promise<{ code: string; rotatesAt: string }> {
    const user = await getSessionUser();
    if (!user) redirect("/login");

    const { code, rotatesAt } = rotateAccessCode(user.id);
    return { code, rotatesAt: rotatesAt.toISOString() };
}
