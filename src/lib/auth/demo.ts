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
