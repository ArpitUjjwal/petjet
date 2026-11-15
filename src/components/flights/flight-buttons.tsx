"use client";

import { CreditCard, Plane } from "lucide-react";
import { useState, useTransition } from "react";
import { bookFlightAction, upgradeAction } from "@/app/actions/flights";
import { Button } from "@/components/ui/button";

export function BookFlightButton({ tripId, leg, flightId, label }: { tripId: string; leg: string; flightId: string; label: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        loading={pending}
        iconLeft={<Plane className="size-3.5" />}
        aria-label={label}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await bookFlightAction({ tripId, leg, flightId });
            if (r && !r.ok) setError(r.message);
          })
        }
      >
        Book
      </Button>
      {error && <p role="alert" className="max-w-56 text-right text-[12px] text-danger-700">{error}</p>}
    </div>
  );
}

export function UpgradeButton({ plan, price, next, highlighted }: { plan: string; price: number; next?: string; highlighted?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Button
        className="w-full"
        variant={highlighted ? "primary" : "secondary"}
        loading={pending}
        iconLeft={<CreditCard className="size-4" />}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await upgradeAction(plan, next);
            if (r && !r.ok) setError(r.message);
          })
        }
      >
        Pay £{price} (simulated)
      </Button>
      {error && <p role="alert" className="mt-2 text-[12px] text-danger-700">{error}</p>}
    </div>
  );
}
