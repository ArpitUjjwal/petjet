"use client";

import { CalendarCheck, Lock } from "lucide-react";
import { useState, useTransition } from "react";
import { requestAppointmentAction } from "@/app/actions/vets";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { VET_PRICES } from "@/lib/trips/costs";
import { isVetService, slotLabel } from "@/lib/vets/core";

export type ShareableDoc = { id: string; fileName: string; label: string; confirmed: boolean };

export function BookVet({
  provider,
  slots,
  documents,
  context,
  prefill = false,
}: {
  provider: { id: string; name: string };
  slots: string[];
  documents: ShareableDoc[];
  context: { petId: string; petName: string; tripId: string; taskId: string; service: string; serviceLabel: string };
  /** Demo happy path: first free time and record sharing already chosen */
  prefill?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<string | null>(prefill ? (slots[0] ?? null) : null);
  const [shared, setShared] = useState<string[]>(documents.filter((d) => d.confirmed).map((d) => d.id));
  const [consent, setConsent] = useState(prefill);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setErrors({});
    setMessage(null);
    start(async () => {
      const r = await requestAppointmentAction({
        providerId: provider.id,
        petId: context.petId,
        tripId: context.tripId,
        taskId: context.taskId,
        service: context.service,
        slot: slot ?? "",
        documentIds: shared,
        consent,
        ownerNote: note,
      });
      /* Success redirects; only failures come back */
      if (r && !r.ok) {
        setErrors(r.errors ?? {});
        setMessage(r.message ?? null);
      }
    });
  }

  /* Demo happy path: one tap books the first time, shares the confirmed records and the practice completes it */
  if (prefill && slots.length) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button size="md" onClick={submit} loading={pending} iconLeft={<CalendarCheck className="size-3.5" />}>
          Book {slotLabel(slots[0])}
        </Button>
        {isVetService(context.service) && (
          <p className="tabular text-right text-[13px]" data-testid="vet-price">
            <span className="font-semibold">£{VET_PRICES[context.service].petjet}</span>{" "}
            <span className="text-ink-400 line-through">£{VET_PRICES[context.service].typical}</span>{" "}
            <span className="text-ok-700">partner price, save £{VET_PRICES[context.service].typical - VET_PRICES[context.service].petjet}</span>
          </p>
        )}
        <p className="text-right text-[12px] text-ink-500">
          {shared.length ? `Shares ${context.petName}'s ${shared.length} confirmed record${shared.length === 1 ? "" : "s"} with the practice` : "Times are simulated for the demo"}
        </p>
        {(message || errors.slot || errors.consent) && (
          <p role="alert" className="max-w-64 text-right text-[12px] text-danger-700">
            {message ?? errors.slot ?? errors.consent}
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <Button
        size="sm"
        onClick={() => setOpen(true)}
        disabled={!slots.length}
        iconLeft={<CalendarCheck className="size-3.5" />}
      >
        {!slots.length ? "No times left" : "Choose a time"}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Book ${provider.name}`}
        description={`${context.serviceLabel} for ${context.petName}. Times are simulated for the demo.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} loading={pending} disabled={!slot || (shared.length > 0 && !consent)}>
              Request appointment
            </Button>
          </>
        }
      >
        <fieldset>
          <legend className="text-[13px] font-medium text-ink-900">Choose a time</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Available times">
            {slots.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={slot === s}
                onClick={() => setSlot(s)}
                className={cn(
                  "tabular h-11 rounded-control border px-3 text-[13px] font-medium transition-colors",
                  slot === s ? "border-forest-800 bg-forest-800 text-cream-50" : "border-line-strong bg-surface hover:border-forest-700/50 hover:bg-sage-50",
                )}
              >
                {slotLabel(s)}
              </button>
            ))}
          </div>
          {errors.slot && <p className="mt-2 text-[13px] text-danger-700">{errors.slot}</p>}
        </fieldset>

        <fieldset className="mt-6">
          <legend className="text-[13px] font-medium text-ink-900">Share records with the practice</legend>
          {documents.length === 0 ? (
            <p className="mt-1 text-[13px] text-ink-500">No documents uploaded for {context.petName} yet. You can bring paper records instead.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {documents.map((d) => (
                <li key={d.id} className="rounded-control border border-line p-3">
                  <Checkbox
                    label={d.label}
                    description={d.fileName}
                    checked={shared.includes(d.id)}
                    onChange={(on) => setShared((s) => (on ? [...s, d.id] : s.filter((x) => x !== d.id)))}
                  />
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        {shared.length > 0 && (
          <div className="mt-4 rounded-control bg-sage-100 p-3">
            <Checkbox
              label={`Share ${shared.length} document${shared.length === 1 ? "" : "s"} with ${provider.name}`}
              description="Only for this appointment. They can't see your other documents or pets, and declining ends access."
              checked={consent}
              onChange={setConsent}
            />
            {errors.consent && <p className="mt-2 text-[13px] text-danger-700">{errors.consent}</p>}
          </div>
        )}

        <div className="mt-5">
          <Textarea label="Note for the vet" optional value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} />
        </div>
        {message && (
          <p role="alert" className="mt-3 text-[13px] text-danger-700">
            {message}
          </p>
        )}
        <p className="mt-4 flex items-center gap-1.5 text-[12px] text-ink-500">
          <Lock className="size-3" />
          Sharing is recorded with the appointment.
        </p>
      </Dialog>
    </>
  );
}
