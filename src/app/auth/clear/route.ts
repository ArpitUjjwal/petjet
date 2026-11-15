import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/token";

/* Clears a stale session cookie and sends the browser to the right login page. */
export function GET(request: NextRequest) {
  const portal = request.nextUrl.searchParams.get("portal");
  const login = portal === "provider" ? "/provider/login" : "/login";
  const response = NextResponse.redirect(new URL(login, request.url));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
