import { ArrowRight, PiggyBank } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { gbp, type TripCosts } from "@/lib/trips/costs";

/** Home: the trip's total and what it saves, in three numbers. */
export function CostSummary({ costs, href, className }: { costs: TripCosts; href: string; className?: string }) {
  return (
    <section
      aria-label="Trip cost and savings"
      data-testid="cost-summary"
      className={cn("rounded-card border border-line bg-surface p-5 shadow-card sm:p-6", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <PiggyBank className="size-5 text-forest-700" /> Cost and savings
        </h2>
        <Badge tone="sample">Sample estimates</Badge>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-control bg-cream-50 p-4">
          <dt className="text-[13px] text-ink-500">{costs.allBooked ? "Your trip costs" : "Your trip, estimated"}</dt>
          <dd className="tabular mt-1 text-2xl font-semibold tracking-tight" data-testid="cost-total">
            {gbp(costs.total)}
          </dd>
          <dd className="text-xs text-ink-500">Vet, flights, insurance and PetJet</dd>
        </div>
        <div className="rounded-control bg-ok-100 p-4">
          <dt className="text-[13px] text-ok-700">You save</dt>
          <dd className="tabular mt-1 text-2xl font-semibold tracking-tight text-ok-700" data-testid="cost-saved">
            {gbp(Math.max(costs.saved, 0))}
          </dd>
          <dd className="text-xs text-ok-700">vs {gbp(costs.typicalTotal)} booking each part yourself</dd>
        </div>
        <div className="rounded-control bg-sage-100 p-4">
          <dt className="text-[13px] text-forest-800">vs a relocation agency</dt>
          <dd className="tabular mt-1 text-2xl font-semibold tracking-tight text-forest-800" data-testid="cost-saved-agency">
            {gbp(costs.savedVsAgency)} less
          </dd>
          <dd className="text-xs text-forest-800">Agencies charge around {gbp(costs.agencyTotal)} for this trip</dd>
        </div>
      </dl>
      <Link href={href} className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-forest-800 hover:underline">
        See the breakdown <ArrowRight className="size-3.5" />
      </Link>
    </section>
  );
}

/** Bookings: every line, with what it would typically cost. */
export function CostBreakdown({ costs }: { costs: TripCosts }) {
  return (
    <section aria-label="Cost breakdown" data-testid="cost-breakdown" className="rounded-card border border-line bg-surface shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <PiggyBank className="size-5 text-forest-700" /> Cost and savings
        </h2>
        <Badge tone="sample">Sample estimates</Badge>
      </div>
      <ul className="divide-y divide-line">
        {costs.lines.map((l) => {
          const saving = l.typical - l.amount;
          return (
            <li key={l.id} data-testid={`cost-line-${l.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {l.label}
                  {!l.booked && <span className="ml-2 text-xs font-normal text-ink-400">estimate</span>}
                </p>
                <p className="text-xs text-ink-500">{l.detail}</p>
              </div>
              <div className="tabular text-right">
                <p className="font-semibold">{gbp(l.amount)}</p>
                {l.id === "plan" ? (
                  <p className="text-xs text-ink-500">PetJet fee</p>
                ) : saving > 0 ? (
                  <p className="text-xs text-ok-700">
                    <span className="mr-1 text-ink-400 line-through">{gbp(l.typical)}</span>save {gbp(saving)}
                  </p>
                ) : (
                  <p className="text-xs text-ink-500">Typical price</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <dl className="tabular grid gap-2 border-t border-line bg-cream-50 p-5 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-500">Booking each part yourself</dt>
          <dd>{gbp(costs.typicalTotal)}</dd>
        </div>
        <div className="flex justify-between font-semibold">
          <dt>With PetJet, fee included</dt>
          <dd data-testid="breakdown-total">{gbp(costs.total)}</dd>
        </div>
        <div className="flex justify-between font-semibold text-ok-700">
          <dt>You save</dt>
          <dd>{gbp(Math.max(costs.saved, 0))}</dd>
        </div>
        <div className="flex justify-between text-forest-800">
          <dt>Compared with a relocation agency ({gbp(costs.agencyTotal)})</dt>
          <dd>{gbp(costs.savedVsAgency)} less</dd>
        </div>
      </dl>
      <p className="px-5 pb-4 text-xs text-ink-500">
        Partner prices, flight fares and agency quotes are illustrative figures for this demo, not real offers.
      </p>
    </section>
  );
}
