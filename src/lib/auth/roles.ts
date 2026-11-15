export const ROLES = ["OWNER", "VET", "LAB"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function isProviderRole(role: Role) {
  return role === "VET" || role === "LAB";
}

/** Where a signed-in user of this role lands. */
export function homeFor(role: Role) {
  return role === "OWNER" ? "/app" : "/provider";
}

/** Which login page serves this role. */
export function loginFor(role: Role) {
  return role === "OWNER" ? "/login" : "/provider/login";
}
