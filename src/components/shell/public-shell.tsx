import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { homeFor } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { PublicMobileMenu } from "./public-mobile-menu";

export const PUBLIC_LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/rules", label: "Routes & rules" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/for-providers", label: "For vets & labs" },
];

export type HeaderAccount = { label: string; href: string } | null;

export async function PublicHeader() {
  const user = await getCurrentUser();
  const account: HeaderAccount = user
    ? { label: user.role === "OWNER" ? "Open dashboard" : "Open portal", href: homeFor(user.role) }
    : null;

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-cream-100/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {PUBLIC_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-control px-3 py-2 text-sm text-ink-700 transition-colors hover:bg-sage-100 hover:text-ink-900"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {account ? (
            <ButtonLink href={account.href} size="sm" iconRight={<ArrowRight className="size-3.5" />}>
              {account.label}
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
                Log in
              </ButtonLink>
              <ButtonLink
                href="/plan"
                size="sm"
                className="hidden sm:inline-flex"
                iconRight={<ArrowRight className="size-3.5" />}
              >
                Plan my trip
              </ButtonLink>
            </>
          )}
          <PublicMobileMenu links={PUBLIC_LINKS} account={account} />
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-cream-50">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <Logo size="sm" />
          <p className="mt-4 text-[13px] leading-relaxed text-ink-500">
            PetJet turns official pet travel rules into a personal plan. It does not issue official
            certificates. Always confirm requirements with the linked government source and your
            vet before travelling.
          </p>
        </div>
        <nav aria-label="Product" className="flex flex-col gap-2.5 text-sm">
          <p className="eyebrow mb-1 text-ink-400">Product</p>
          {PUBLIC_LINKS.slice(0, 3).map((l) => (
            <Link key={l.href} href={l.href} className="text-ink-700 hover:text-forest-800 hover:underline">
              {l.label}
            </Link>
          ))}
          <Link href="/rules" className="text-ink-700 hover:text-forest-800 hover:underline">
            Rules & sources
          </Link>
        </nav>
        <nav aria-label="Accounts" className="flex flex-col gap-2.5 text-sm">
          <p className="eyebrow mb-1 text-ink-400">Accounts</p>
          <Link href="/login" className="text-ink-700 hover:text-forest-800 hover:underline">
            Customer login
          </Link>
          <Link href="/signup" className="text-ink-700 hover:text-forest-800 hover:underline">
            Create an account
          </Link>
          <Link href="/for-providers" className="text-ink-700 hover:text-forest-800 hover:underline">
            For vets & labs
          </Link>
          <Link href="/provider/login" className="text-ink-700 hover:text-forest-800 hover:underline">
            Provider login
          </Link>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto w-full max-w-6xl px-4 py-5 text-xs text-ink-400 sm:px-6">
          © {new Date().getFullYear()} PetJet · Demo build. Vet slots, flights, payments and
          partner offers shown in this demo are simulated.
        </p>
      </div>
    </footer>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
