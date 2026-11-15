import { NextResponse, type NextRequest } from "next/server";
import { guard } from "@/lib/auth/routes";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/token";

/* Fast, optimistic redirect based on the signed cookie only.
   The authoritative check (against the database) is requireOwner / requireProvider
   in src/lib/auth/session.ts, called by every protected layout, page and action. */
export async function proxy(request: NextRequest) {
  const session = await verifySession(
    request.cookies.get(SESSION_COOKIE)?.value,
    process.env.SESSION_SECRET ?? "",
  ).catch(() => null);

  const { pathname, search } = request.nextUrl;
  const target = guard(pathname, session?.role ?? null, search);
  if (!target) return NextResponse.next();
  return NextResponse.redirect(new URL(target, request.url));
}

export const config = {
  matcher: ["/app/:path*", "/provider/:path*", "/plan/:path*", "/plan", "/login", "/signup"],
};
