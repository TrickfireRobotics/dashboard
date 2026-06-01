import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userFeature } from "@/lib/db/schema";
import { FEATURE_ROUTES } from "@/lib/features";

// Run on the Node.js runtime so the better-sqlite3-backed auth/db can be used
// to enforce the deactivated-user check on every protected request.
export const runtime = "nodejs";

const SESSION_COOKIES = ["better-auth.session_token", "__Secure-better-auth.session_token"];

function redirectToLogin(req: NextRequest, deactivated = false) {
    const url = new URL("/login", req.url);
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

    // `isActive` is fetched fresh from the DB by getSession, so a member
    // deactivated mid-session is caught here on their next request.
    if (session.user.isActive === false) {
        return redirectToLogin(req, true);
    }

    // Unapproved users land on the pending page until an admin approves them.
    if (!session.user.approved) {
        return NextResponse.redirect(new URL("/pending", req.url));
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
                    const url = new URL("/features", req.url);
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
