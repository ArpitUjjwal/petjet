import { ArrowLeft, Compass } from "lucide-react";
import type { Metadata } from "next";
import { PublicShell } from "@/components/shell/public-shell";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <PublicShell>
      <section className="mx-auto flex w-full max-w-xl flex-col items-center px-4 py-24 text-center sm:py-32">
        <span className="grid size-14 place-items-center rounded-2xl bg-sage-100 text-forest-800">
          <Compass className="size-6" />
        </span>
        <p className="eyebrow mt-6 text-tan-600">Error 404</p>
        <h1 className="display-lg mt-3 text-forest-900">This page has flown off.</h1>
        <p className="mt-4 text-[17px] text-ink-500">
          We couldn&apos;t find the page you were looking for. It may have moved, or the link may be
          wrong.
        </p>
        <ButtonLink href="/" size="lg" className="mt-8" iconLeft={<ArrowLeft className="size-4" />}>
          Back to home
        </ButtonLink>
      </section>
    </PublicShell>
  );
}
