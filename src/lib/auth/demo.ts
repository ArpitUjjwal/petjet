import "server-only";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "../../../prisma/demo-accounts";

/* Demo account shortcuts are shown on the login pages unless DEMO_MODE=false. */
export function demoAccountsFor(portal: "owner" | "provider") {
  if (process.env.DEMO_MODE === "false") return [];
  if (portal === "owner") {
    return [{ label: "Demo pet owner", email: DEMO_ACCOUNTS.owner.email, password: DEMO_PASSWORD }];
  }
  return [
    { label: "Demo vet", email: DEMO_ACCOUNTS.vet.email, password: DEMO_PASSWORD },
    { label: "Demo lab", email: DEMO_ACCOUNTS.lab.email, password: DEMO_PASSWORD },
  ];
}

/* ---------- Demo switcher ---------- */

export type DemoWho = keyof typeof DEMO_ACCOUNTS;
export const DEMO_WHO: DemoWho[] = ["owner", "vet", "lab"];

const DEMO_LABEL: Record<DemoWho, string> = { owner: "Pet owner", vet: "Vet", lab: "Lab" };

export function isDemoWho(v: unknown): v is DemoWho {
  return typeof v === "string" && (DEMO_WHO as string[]).includes(v);
}

/** Which demo account an email belongs to, or null for any real account. */
export function demoWhoFor(email: string): DemoWho | null {
  const e = email.trim().toLowerCase();
  return DEMO_WHO.find((w) => DEMO_ACCOUNTS[w].email === e) ?? null;
}

export function isDemoEmail(email: string) {
  return demoWhoFor(email) !== null;
}

/**
 * The switcher's buttons for the signed-in user. Empty unless demo mode is on and the user is
 * one of the demo accounts, so real accounts never see it and can never switch.
 */
export function demoSwitchTargets(currentEmail: string) {
  if (process.env.DEMO_MODE === "false") return [];
  const current = demoWhoFor(currentEmail);
  if (!current) return [];
  return DEMO_WHO.map((who) => ({ who, label: DEMO_LABEL[who], email: DEMO_ACCOUNTS[who].email, current: who === current }));
}
