"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ClipboardList,
  FileText,
  FlaskConical,
  Home,
  Inbox,
  LogOut,
  Menu,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Drawer } from "@/components/ui/dialog";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/cn";

/** `also`: other path prefixes that belong to this tab (pages reached from it) */
export type NavItem = { href: string; label: string; icon: LucideIcon; also?: string[] };
export type ShellRole = "owner" | "vet" | "lab";

export const NAV: Record<ShellRole, NavItem[]> = {
  owner: [
    { href: "/app", label: "Home", icon: Home, also: ["/app/pets", "/app/notifications"] },
    { href: "/app/trips", label: "Trip plan", icon: ClipboardList },
    { href: "/app/documents", label: "Documents", icon: FileText },
    { href: "/app/bookings", label: "Bookings", icon: Ticket, also: ["/app/vets", "/app/flights", "/app/insurance", "/app/upgrade"] },
  ],
  vet: [
    { href: "/provider", label: "Requests", icon: Inbox },
    { href: "/provider/notifications", label: "Notifications", icon: Bell },
  ],
  lab: [
    { href: "/provider", label: "Test orders", icon: FlaskConical },
    { href: "/provider/notifications", label: "Notifications", icon: Bell },
  ],
};

const roleLabel: Record<ShellRole, string> = {
  owner: "Pet owner",
  vet: "Veterinary practice",
  lab: "Pathology lab",
};

const under = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

export function isActive(pathname: string, href: string, root: string, also: string[] = []) {
  if (also.some((p) => under(pathname, p))) return true;
  if (href === "/provider") return pathname === root || /^\/provider\/(appointments|lab-orders)\//.test(pathname);
  return href === root ? pathname === root : pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({
  role,
  pathname,
  onNavigate,
}: {
  role: ShellRole;
  pathname: string;
  onNavigate?: () => void;
}) {
  const root = role === "owner" ? "/app" : "/provider";
  return (
    <ul className="flex flex-col gap-0.5">
      {NAV[role].map(({ href, label, icon: Icon, also }) => {
        const active = isActive(pathname, href, root, also);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex h-10 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors duration-150",
                active
                  ? "bg-forest-800 text-cream-50 shadow-xs"
                  : "text-ink-700 hover:bg-sage-100 hover:text-ink-900",
              )}
            >
              <Icon
                className={cn(
                  "size-[18px] shrink-0",
                  active ? "text-sage-300" : "text-ink-400 group-hover:text-forest-700",
                )}
              />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function UserCard({ name, role, onLogout }: { name: string; role: ShellRole; onLogout?: ReactNode }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="flex items-center gap-3 rounded-control border border-line bg-surface p-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sage-200 text-xs font-semibold text-forest-800">
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-ink-500">{roleLabel[role]}</p>
      </div>
      {onLogout}
    </div>
  );
}

export function AppShell({
  role,
  userName,
  logoutSlot,
  unread = 0,
  demoSlot,
  children,
}: {
  role: ShellRole;
  userName: string;
  /** Rendered next to the user card; usually a logout form button */
  logoutSlot?: ReactNode;
  unread?: number;
  /** The demo switcher bar, for demo accounts only */
  demoSlot?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const home = role === "owner" ? "/app" : "/provider";
  const logout = logoutSlot ?? (
    <span className="grid size-8 place-items-center text-ink-400">
      <LogOut className="size-4" />
    </span>
  );

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-cream-50 px-4 py-5 lg:flex">
        <Logo href={home} className="px-2" />
        <nav aria-label="Primary" className="mt-8 flex-1 overflow-y-auto">
          <NavList role={role} pathname={pathname} />
        </nav>
        <UserCard name={userName} role={role} onLogout={logout} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {demoSlot}
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line/70 bg-cream-100/85 px-4 backdrop-blur-md sm:px-6 lg:justify-end">
          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
              className="grid size-10 place-items-center rounded-control text-ink-700 hover:bg-sage-100"
            >
              <Menu className="size-5" />
            </button>
            <Logo href={home} size="sm" />
          </div>
          <Link
            href={`${home}/notifications`}
            aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
            className="relative grid size-10 place-items-center rounded-control text-ink-700 transition-colors hover:bg-sage-100"
          >
            <Bell className="size-5" />
            {unread > 0 && (
              <span className="tabular absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-tan-500 px-1 text-[10px] font-semibold text-forest-950">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>

      <Drawer open={open} onClose={() => setOpen(false)} title="Menu" className="max-w-xs">
        <nav aria-label="Primary mobile">
          <NavList role={role} pathname={pathname} onNavigate={() => setOpen(false)} />
        </nav>
        <div className="mt-6">
          <UserCard name={userName} role={role} onLogout={logout} />
        </div>
      </Drawer>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-500 sm:text-[15px]">{description}</p>}
      </div>
      {action}
    </div>
  );
}
