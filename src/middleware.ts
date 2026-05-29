import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth";

// Run on the Node.js runtime so the better-sqlite3-backed auth/db can be used
// to enforce the deactivated-user check on every protected request.
export const runtime = "nodejs";

const SESSION_COOKIES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
];

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

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/orders/:path*",
    "/api-keys/:path*",
    "/minecraft/:path*",
    "/admin/:path*",
  ],
};
