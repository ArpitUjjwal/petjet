"use client";

import { Check, ChevronDown, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { changeInsuranceAction, chooseInsuranceAction } from "@/app/actions/insurance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { DETAIL_ROWS, type InsuranceOffer } from "@/lib/insurance/offers";
import { insuranceDirectPrice } from "@/lib/trips/costs";

export function InsurerLogo({ offer, className }: { offer: Pick<InsuranceOffer, "logo" | "insurer">; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small static SVG wordmarks
    <img src={offer.logo} alt={offer.insurer} className={cn("h-10 w-auto", className)} />
  );
}

export function InsurancePicker({ tripId, offers, petName }: { tripId: string; offers: InsuranceOffer[]; petName: string }) {
  const [selected, setSelected] = useState(offers.find((o) => o.recommended)?.id ?? offers[0]?.id);
  const [compare, setCompare] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const chosen = offers.find((o) => o.id === selected);

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid gap-4 md:grid-cols-2" aria-label="Insurance offers" role="radiogroup">
        {offers.map((o) => {
          const active = o.id === selected;
          return (
            <li key={o.id}>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                data-testid="insurance-offer"
                onClick={() => setSelected(o.id)}
                className={cn(
                  "flex h-full w-full flex-col rounded-card border bg-surface p-5 text-left transition-[border-color,box-shadow] duration-200",
                  active ? "border-forest-800 shadow-raised ring-2 ring-forest-800/15" : "border-line shadow-card hover:border-forest-700/40",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <InsurerLogo offer={o} />
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full border",
                      active ? "border-forest-800 bg-forest-800 text-cream-50" : "border-line-strong",
                    )}
                  >
                    {active && <Check className="size-3.5" />}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-1.5">
                  <Badge tone={o.recommended ? "brand" : "neutral"}>{o.tag}</Badge>
                  <Badge tone="sample">Sample</Badge>
                </div>
                <p className="mt-3 font-semibold">{o.plan}</p>
                <p className="text-sm text-ink-500">{o.summary}</p>
                <p className="tabular mt-3 text-3xl font-semibold tracking-tight">
                  £{o.price}
                  <span className="ml-1 text-sm font-normal text-ink-500">{o.id === "paws" ? "per year" : "per trip"}</span>
                </p>
                <p className="tabular mt-0.5 text-[13px] text-ok-700" data-testid="insurance-saving">
                  <span className="mr-1 text-ink-400 line-through">£{insuranceDirectPrice(o.price)}</span>
                  Save £{insuranceDirectPrice(o.price) - o.price} with PetJet&apos;s partner rate
                </p>
                <p className="tabular mt-0.5 text-[13px] text-ink-500">
                  Vet fees up to {o.details.vetFees} · {o.details.excess} excess
                </p>
                <ul className="mt-4 flex flex-col gap-1.5 text-sm">
                  {o.highlights.map((h) => (
                    <li key={h} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-forest-800" />
                      {h}
                    </li>
                  ))}
                </ul>
              </button>
            </li>
          );
        })}
      </ul>

      <div>
        <button
          type="button"
          onClick={() => setCompare((c) => !c)}
          aria-expanded={compare}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-800 hover:underline"
        >
          <ChevronDown className={cn("size-4 transition-transform", compare && "rotate-180")} />
          {compare ? "Hide comparison" : "Compare all details"}
        </button>
        {compare && (
          <div className="mt-3 overflow-x-auto rounded-card border border-line bg-surface">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="p-3 text-left font-medium text-ink-500"> </th>
                  {offers.map((o) => (
                    <th key={o.id} className={cn("p-3 text-left font-semibold", o.id === selected && "bg-sage-50")}>
                      {o.insurer}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line">
                  <td className="p-3 text-ink-500">Price</td>
                  {offers.map((o) => (
                    <td key={o.id} className={cn("tabular p-3 font-medium", o.id === selected && "bg-sage-50")}>
                      £{o.price}
                    </td>
                  ))}
                </tr>
                {DETAIL_ROWS.map((r) => (
                  <tr key={r.key} className="border-b border-line last:border-0">
                    <td className="p-3 text-ink-500">{r.label}</td>
                    {offers.map((o) => (
                      <td key={o.id} className={cn("tabular p-3", o.id === selected && "bg-sage-50")}>
                        {o.details[r.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="sticky bottom-4 flex flex-col items-stretch gap-2 rounded-card border border-line bg-surface p-4 shadow-raised sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          {chosen ? (
            <>
              <strong>{chosen.insurer}</strong> · {chosen.plan} for {petName} · <span className="tabular">£{chosen.price}</span>{" "}
              <span className="tabular text-ok-700">(save £{insuranceDirectPrice(chosen.price) - chosen.price})</span>
            </>
          ) : (
            "Choose a plan"
          )}
        </p>
        <Button
          size="lg"
          loading={pending}
          disabled={!chosen}
          iconLeft={<ShieldCheck className="size-4" />}
          onClick={() =>
            chosen &&
            start(async () => {
              setError(null);
              const r = await chooseInsuranceAction(tripId, chosen.id);
              if (r && !r.ok) setError(r.message);
            })
          }
        >
          Choose this cover
        </Button>
      </div>
      {error && <p role="alert" className="text-sm text-danger-700">{error}</p>}
    </div>
  );
}

export function ChangeInsuranceButton({ tripId }: { tripId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="sm" loading={pending} onClick={() => start(async () => void (await changeInsuranceAction(tripId)))}>
      Change cover
    </Button>
  );
}
