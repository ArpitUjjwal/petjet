"use client";

import { Check, RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { markStepDone, undoStepDone } from "@/app/actions/trips";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/rules/dates";
import { petNames } from "@/lib/trips/dashboard";
import type { OwnerStep } from "@/lib/trips/records";

/*
 * Lets an owner confirm a step they do themselves (a form, a booking, a notice).
 * Vet and lab steps never get this control.
 */
export function OwnerStepControl({
  tripId,
  pets,
  taskId,
  taskTitle,
  done,
  record,
  step,
  today,
  size = "sm",
}: {
  tripId: string;
  /** Every pet this tick applies to */
  pets: { id: string; name: string }[];
  taskId: string;
  taskTitle: string;
  done: boolean;
  record?: { doneOn: string; source: string };
  step: OwnerStep;
  today: string;
  size?: "sm" | "md";
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const petIds = pets.map((p) => p.id);
  const petName = petNames(pets);

  if (done) {
    const byOwner = record?.source === "OWNER";
    return (
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-500">
        {record && (
          <span className="tabular">
            {step.doneLabel} {formatDate(record.doneOn)}
            {byOwner ? " · confirmed by you" : ""}
          </span>
        )}
        {byOwner && (
          <Button
            variant="ghost"
            size="sm"
            loading={pending}
            iconLeft={<RotateCcw className="size-3.5" />}
            aria-label={`Undo: ${taskTitle} for ${petName}`}
            onClick={() =>
              start(async () => {
                const r = await undoStepDone({ tripId, petIds, taskId });
                if (r.ok) toast({ tone: "info", title: "Marked as not done", detail: `${taskTitle} · ${petName}` });
                else toast({ tone: "danger", title: r.message ?? "Couldn't undo that." });
              })
            }
          >
            Undo
          </Button>
        )}
      </span>
    );
  }

  function save() {
    setError(null);
    start(async () => {
      const r = await markStepDone({ tripId, petIds, taskId, doneOn: date });
      if (r.ok) {
        setOpen(false);
        toast({ title: "Step done", detail: `${taskTitle} · ${petName}` });
      } else {
        setError(r.errors?.doneOn ?? r.message ?? "Couldn't save that.");
      }
    });
  }

  return (
    <>
      <Button
        variant="secondary"
        size={size}
        iconLeft={<Check className="size-3.5" />}
        aria-label={`Mark as done: ${taskTitle} for ${petName}`}
        onClick={() => {
          setDate(today);
          setError(null);
          setOpen(true);
        }}
      >
        Mark as done
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={step.question}
        description={`${taskTitle} for ${petName}. You can undo this later.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Not yet
            </Button>
            <Button onClick={save} loading={pending} iconLeft={<Check className="size-4" />}>
              Yes, it&apos;s done
            </Button>
          </>
        }
      >
        <Input
          type="date"
          label={step.dateLabel}
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value)}
          error={error ?? undefined}
        />
      </Dialog>
    </>
  );
}
