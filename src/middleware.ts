import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Let Auth0 handle its own routes (login, logout, callback, etc.)
  const authResponse = await auth0.middleware(req);

  // If Auth0 handled this route, return its response
  if (authResponse.status !== 200 || pathname.startsWith("/auth/")) {
    // Check if it's an auth route specifically
    if (
      pathname.startsWith("/auth/login") ||
      pathname.startsWith("/auth/logout") ||
      pathname.startsWith("/auth/callback") ||
      pathname.startsWith("/auth/")
    ) {
      return authResponse;
    }
  }

  const isOrganizerRoute =
    pathname.startsWith("/organizer") ||
    pathname.startsWith("/api/organizer");

  const isAdminRoute =
    pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (isOrganizerRoute || isAdminRoute) {
    const session = await auth0.getSession(req);

    if (!session?.user) {
      const loginUrl = new URL("/auth/login", req.url);
      loginUrl.searchParams.set("returnTo", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Extract roles from Auth0 session claims
    // Auth0 stores custom claims under a namespace; fall back to checking roles claim
    const userRoles: string[] =
      (session.user["https://yass.app/roles"] as string[] | undefined) ??
      (session.user["roles"] as string[] | undefined) ??
      [];

    if (isAdminRoute) {
      if (!userRoles.includes("admin")) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    } else if (isOrganizerRoute) {
      if (!userRoles.includes("admin") && !userRoles.includes("organizer")) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    }
  }

  return authResponse;
}

export const config = {
  matcher: [
    // Auth routes
    "/auth/:path*",
    // Protected routes
    "/organizer/:path*",
    "/api/organizer/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};
