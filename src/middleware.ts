import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userFeature } from "@/lib/db/schema";
import { FEATURE_ROUTES } from "@/lib/features";

export const runtime = "nodejs";

const SESSION_COOKIES = ["better-auth.session_token", "__Secure-better-auth.session_token"];

function resolveUrl(req: NextRequest, path: string): URL {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") ?? "http";
    if (host) return new URL(path, `${proto}://${host}`);
    return new URL(path, req.url);
}

function redirectToLogin(req: NextRequest, deactivated = false) {
    const url = resolveUrl(req, "/login");
    if (deactivated) {
        url.searchParams.set("deactivated", "1");
    }
    const res = NextResponse.redirect(url);
    if (deactivated) {
        for (const name of SESSION_COOKIES) {
            res.cookies.delete(name);
        }
    }
    return res;
}

export async function middleware(req: NextRequest) {
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user) {
        return redirectToLogin(req);
    }

    if (session.user.isActive === false) {
        return redirectToLogin(req, true);
    }

    if (!session.user.approved) {
        return NextResponse.redirect(resolveUrl(req, "/pending"));
    }

    // Admins bypass per-feature checks.
    if (session.user.role !== "admin") {
        const path = req.nextUrl.pathname;
        for (const [prefix, featureKey] of Object.entries(FEATURE_ROUTES)) {
            if (path === prefix || path.startsWith(`${prefix}/`)) {
                const granted = db
                    .select({ id: userFeature.id })
                    .from(userFeature)
                    .where(
                        and(
                            eq(userFeature.userId, session.user.id),
                            eq(userFeature.featureKey, featureKey),
                            eq(userFeature.status, "granted")
                        )
                    )
                    .get();
                if (!granted) {
                    const url = resolveUrl(req, "/features");
                    url.searchParams.set("denied", featureKey);
                    return NextResponse.redirect(url);
                }
                break;
            }
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/dashboard/:path*",
        "/features/:path*",
        "/orders/:path*",
        "/api-keys/:path*",
        "/minecraft/:path*",
        "/headscale/:path*",
        "/admin/:path*",
    ],
};
