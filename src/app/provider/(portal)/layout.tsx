import type { Metadata } from "next";
import { LogoutButton } from "@/components/auth/logout-button";
import { AppShell } from "@/components/shell/app-shell";
import { demoSwitchTargets } from "@/lib/auth/demo";
import { requireProvider } from "@/lib/auth/session";
import { unreadCount } from "@/lib/notifications/repository";
import { DemoSwitcher } from "@/components/shell/demo-switcher";

export const metadata: Metadata = { robots: { index: false } };

export default async function ProviderLayout({ children }: LayoutProps<"/provider">) {
  const user = await requireProvider();
  const unread = await unreadCount(user.id);
  return (
    <AppShell
      role={user.role === "LAB" ? "lab" : "vet"}
      userName={user.name}
      logoutSlot={<LogoutButton />}
      unread={unread}
      demoSlot={<DemoSwitcher targets={demoSwitchTargets(user.email)} />}
    >
      {children}
    </AppShell>
  );
}
