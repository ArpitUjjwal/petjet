"use client";

import { ArrowRight, Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Drawer } from "@/components/ui/dialog";
import type { HeaderAccount } from "./public-shell";

export function PublicMobileMenu({
  links,
  account,
}: {
  links: { href: string; label: string }[];
  account: HeaderAccount;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="grid size-10 place-items-center rounded-control text-ink-700 transition-colors hover:bg-sage-100 md:hidden"
      >
        <Menu className="size-5" />
      </button>
      <Drawer open={open} onClose={close} title="Menu" className="max-w-xs">
        <nav aria-label="Main mobile" className="flex flex-col gap-0.5">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={close}
              className="flex h-11 items-center rounded-control px-3 text-[15px] font-medium text-ink-700 transition-colors hover:bg-sage-100 hover:text-ink-900"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 flex flex-col gap-2 border-t border-line pt-6">
          {account ? (
            <ButtonLink href={account.href} onClick={close} iconRight={<ArrowRight className="size-4" />}>
              {account.label}
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href="/plan" onClick={close} iconRight={<ArrowRight className="size-4" />}>
                Plan my trip
              </ButtonLink>
              <ButtonLink href="/login" onClick={close} variant="secondary">
                Log in
              </ButtonLink>
            </>
          )}
        </div>
      </Drawer>
    </>
  );
}
