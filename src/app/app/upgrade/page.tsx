import { Check, CheckCircle2, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { UpgradeButton } from "@/components/flights/flight-buttons";
import { PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/feedback";
import { requireOwner } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { db } from "@/lib/db";
import { TIERS, formatPrice } from "@/lib/marketing/pricing";

export const metadata: Metadata = { title: "Plans" };

const ORDER = ["EXPLORE", "PLAN", "COMPLETE"];

export default async function UpgradePage({ searchParams }: PageProps<"/app/upgrade">) {
  const user = await requireOwner();
  const { next, upgraded } = await searchParams;
  const account = await db.user.findUnique({ where: { id: user.id }, select: { plan: true } });
  const current = account?.plan ?? "EXPLORE";
  const nextPath = typeof next === "string" && next.startsWith("/app") ? next : undefined;

  return (
    <>
      <PageHeader title="Plans" description="Prices per trip. Checkout is simulated for the demo: no card details are taken and nothing is charged." />
      {upgraded && (
        <Callout tone="ok" icon={<CheckCircle2 className="size-4.5" />} title="Plan upgraded" className="mb-6">
          You&apos;re on {TIERS.find((t) => t.id === current)?.name}. Payment was simulated.
        </Callout>
      )}
      <ul className="grid gap-4 lg:grid-cols-3">
        {TIERS.map((t) => {
          const isCurrent = t.id === current;
          const below = ORDER.indexOf(t.id) < ORDER.indexOf(current);
          return (
            <li
              key={t.id}
              data-testid={`tier-${t.id}`}
              className={cn(
                "flex flex-col rounded-card border p-6",
                t.highlighted || t.id === "COMPLETE" ? "border-forest-800 bg-surface shadow-raised" : "border-line bg-surface shadow-card",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-lg font-semibold">{t.name}</p>
                {isCurrent && <Badge tone="brand">Your plan</Badge>}
                {t.id === "COMPLETE" && !isCurrent && <Badge tone="info">Unlocks flight booking</Badge>}
              </div>
              <p className="mt-1 text-sm text-ink-500">{t.tagline}</p>
              <p className="tabular mt-4 text-4xl font-semibold tracking-tight">
                {formatPrice(t.price)}
                {t.price > 0 && <span className="ml-1 text-sm font-normal text-ink-500">per trip</span>}
              </p>
              <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-forest-800" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {isCurrent ? (
                  <p className="text-center text-sm font-medium text-ink-500">Current plan</p>
                ) : below || t.price === 0 ? (
                  <p className="text-center text-sm text-ink-400">Included</p>
                ) : (
                  <UpgradeButton plan={t.id} price={t.price} next={nextPath} highlighted={t.id === "COMPLETE"} />
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 flex items-center gap-2 text-[13px] text-ink-500">
        <ShieldCheck className="size-4" /> Prices are hypotheses from the business plan, shown for the demo.
      </p>
    </>
  );
}
