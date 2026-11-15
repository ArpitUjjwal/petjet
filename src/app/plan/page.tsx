import { X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PlanWizard } from "@/components/plan/plan-wizard";
import { Logo } from "@/components/ui/logo";
import { getCurrentUser } from "@/lib/auth/session";
import { todayISO } from "@/lib/rules/dates";
import { listPets } from "@/lib/trips/repository";

export const metadata: Metadata = { title: "Plan a trip" };

export default async function PlanPage() {
  const user = await getCurrentUser();
  const pets = user?.role === "OWNER" ? await listPets(user.id) : [];
  const exitHref = user ? "/app" : "/";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-cream-100/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo href={exitHref} />
          <Link
            href={exitHref}
            className="inline-flex h-9 items-center gap-1.5 rounded-control px-3 text-sm font-medium text-ink-700 transition-colors hover:bg-sage-100"
          >
            <X className="size-4" /> Exit
          </Link>
        </div>
      </header>
      <main className="flex-1">
        <PlanWizard existingPets={pets} today={todayISO()} signedIn={user?.role === "OWNER"} />
      </main>
    </div>
  );
}
