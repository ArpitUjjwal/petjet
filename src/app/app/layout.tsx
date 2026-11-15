import type { Metadata } from "next";
import { LogoutButton } from "@/components/auth/logout-button";
import { AppShell } from "@/components/shell/app-shell";
import { DEMO_ACCOUNTS } from "../../../prisma/demo-accounts";
import { requireOwner } from "@/lib/auth/session";
import { unreadCount } from "@/lib/notifications/repository";
import { DemoBar } from "@/components/shell/demo-switcher";

export const metadata: Metadata = { robots: { index: false } };

export default async function OwnerLayout({ children }: LayoutProps<"/app">) {
  const user = await requireOwner();
  const unread = await unreadCount(user.id);
  return (
    <AppShell
      role="owner"
      userName={user.name}
      logoutSlot={<LogoutButton />}
      unread={unread}
      demoSlot={<DemoBar show={process.env.DEMO_MODE !== "false" && user.email.toLowerCase() === DEMO_ACCOUNTS.owner.email} />}
    >
      {children}
    </AppShell>
  );
}
