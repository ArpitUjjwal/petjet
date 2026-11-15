import type { Metadata } from "next";
import { LogoutButton } from "@/components/auth/logout-button";
import { AppShell } from "@/components/shell/app-shell";
import { requireOwner } from "@/lib/auth/session";

export const metadata: Metadata = { robots: { index: false } };

export default async function OwnerLayout({ children }: LayoutProps<"/app">) {
  const user = await requireOwner();
  return (
    <AppShell role="owner" userName={user.name} logoutSlot={<LogoutButton />}>
      {children}
    </AppShell>
  );
}
