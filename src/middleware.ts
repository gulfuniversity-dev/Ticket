import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "insecure-dev-secret-change-me"
);

async function readSession(req: NextRequest) {
  const token = req.cookies.get("gu_session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return { id: String(payload.sub), role: payload.role as string };
  } catch {
    return null;
  }
}

// Admin-only areas (pages + APIs)
const ADMIN_PREFIXES = ["/admin", "/api/admin"];
// Areas any authenticated staff (admin or gate_staff) may use
const STAFF_PREFIXES = ["/scan", "/search", "/api/scan", "/api/search"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await readSession(req);

  const isAdminArea = ADMIN_PREFIXES.some((p) => pathname.startsWith(p));
  const isStaffArea = STAFF_PREFIXES.some((p) => pathname.startsWith(p));

  if (!isAdminArea && !isStaffArea) return NextResponse.next();

  const isApi = pathname.startsWith("/api");

  if (!session) {
    if (isApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAdminArea && session.role !== "admin") {
    if (isApi) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const url = req.nextUrl.clone();
    url.pathname = "/scan"; // gate staff land on the scanner
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/scan/:path*", "/search/:path*", "/api/:path*"],
};
