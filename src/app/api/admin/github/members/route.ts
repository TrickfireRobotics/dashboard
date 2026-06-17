import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { GithubError, getOrgMembers, inviteMember } from "@/lib/integrations/github";
import { getSessionUser } from "@/lib/auth/session";

export async function GET() {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        const members = await getOrgMembers();
        // null means GitHub isn't configured; an empty org is `[]`.
        return NextResponse.json({ members: members ?? [] });
    } catch (err) {
        const status = err instanceof GithubError ? 502 : 500;
        const message = err instanceof Error ? err.message : "Failed to load members";
        return NextResponse.json({ error: message }, { status });
    }
}

// GitHub usernames: 1-39 chars, alphanumeric or single hyphens, may not begin
// or end with a hyphen.
const githubUsername = z
    .string()
    .trim()
    .min(1)
    .max(39)
    .regex(/^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/, "Invalid GitHub username");

// Invite by username or email - exactly one. Role is fixed server-side to a
// regular member; this endpoint never invites owners.
const inviteSchema = z
    .object({
        username: githubUsername.optional(),
        email: z.string().trim().email().max(255).optional(),
    })
    .refine((v) => Boolean(v.username) !== Boolean(v.email), {
        message: "Provide either a username or an email, not both",
    });

export async function POST(req: NextRequest) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => null);
    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid input", issues: parsed.error.flatten() },
            { status: 400 }
        );
    }

    try {
        await inviteMember(parsed.data);
        return NextResponse.json({ success: true }, { status: 201 });
    } catch (err) {
        const status = err instanceof GithubError ? 502 : 500;
        const message = err instanceof Error ? err.message : "Failed to invite member";
        return NextResponse.json({ error: message }, { status });
    }
}
