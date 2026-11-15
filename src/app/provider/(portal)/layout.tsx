import type { Metadata } from "next";
import { LogoutButton } from "@/components/auth/logout-button";
import { AppShell } from "@/components/shell/app-shell";
import { requireProvider } from "@/lib/auth/session";

export const metadata: Metadata = { robots: { index: false } };

export default async function ProviderLayout({ children }: LayoutProps<"/provider">) {
  const user = await requireProvider();
  return (
    <AppShell
      role={user.role === "LAB" ? "lab" : "vet"}
      userName={user.name}
      logoutSlot={<LogoutButton />}
    >
      {children}
    </AppShell>
  );
}
