import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth/auth";

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

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/dashboard/:path*",
        "/orders/:path*",
        "/api-keys/:path*",
        "/minecraft/:path*",
        "/network/:path*",
        "/admin/:path*",
    ],
};
