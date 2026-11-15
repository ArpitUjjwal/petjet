import { homeFor, isProviderRole, type Role } from "./roles";

const OWNER_AREA = "/app";
const PROVIDER_AREA = "/provider";
const PROVIDER_LOGIN = "/provider/login";
const GUEST_ONLY = ["/login", "/signup", PROVIDER_LOGIN];
/** Open to guests and pet owners, but not to provider accounts */
const PLANNER = "/plan";

function within(pathname: string, area: string) {
  return pathname === area || pathname.startsWith(`${area}/`);
}

export type Area = "owner" | "provider" | "guest-only" | "planner" | "public";

export function areaOf(pathname: string): Area {
  if (GUEST_ONLY.includes(pathname)) return "guest-only";
  if (within(pathname, PLANNER)) return "planner";
  if (within(pathname, OWNER_AREA)) return "owner";
  if (within(pathname, PROVIDER_AREA)) return "provider";
  return "public";
}

/**
 * Decides whether a request must be redirected.
 * Returns the path to redirect to, or null to let the request through.
 */
export function guard(pathname: string, role: Role | null, search = ""): string | null {
  const area = areaOf(pathname);

  if (area === "public") return null;

  if (area === "guest-only") return role ? homeFor(role) : null;

  if (area === "planner") return role && isProviderRole(role) ? homeFor(role) : null;

  if (!role) {
    const login = area === "owner" ? "/login" : PROVIDER_LOGIN;
    const next = encodeURIComponent(pathname + search);
    return `${login}?next=${next}`;
  }

  if (area === "owner" && role !== "OWNER") return homeFor(role);
  if (area === "provider" && !isProviderRole(role)) return homeFor(role);
  return null;
}

/**
 * Only allow post-login redirects to a path inside the signed-in role's own area.
 * Anything else (other sites, protocol-relative URLs, another role's area) falls back to home.
 */
export function safeNext(next: unknown, role: Role): string {
  const home = homeFor(role);
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return home;
  if (next.includes("\\") || /[\u0000-\u001f]/.test(next)) return home;
  let pathname: string;
  try {
    const url = new URL(next, "http://petjet.local");
    if (url.origin !== "http://petjet.local") return home;
    pathname = url.pathname;
  } catch {
    return home;
  }
  return guard(pathname, role) === null && areaOf(pathname) !== "public" ? next : home;
}
