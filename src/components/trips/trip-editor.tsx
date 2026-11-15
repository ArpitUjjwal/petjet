"use client";

import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleSlash,
  Lock,
  MoveRight,
  Plus,
  Unlock,
} from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, useTransition, type ReactNode } from "react";
import { changeTripDates } from "@/app/actions/trips";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { formatDate, type ISODate } from "@/lib/rules/dates";
import type { Rule } from "@/lib/rules/types";
import { suggestDates, type DateSuggestion } from "@/lib/trips/dashboard";
import { diffPlans, type PlanChange } from "@/lib/trips/diff";
import { planStoredTrip, type StoredTrip } from "@/lib/trips/plan";
import { issuesToErrors, tripDatesSchema } from "@/lib/trips/schemas";
import { TripStatusBadge } from "./trip-status";

/*
 * Changing a trip's dates. The engine runs in the browser on every change, so the dialog
 * shows exactly what the saved plan will say before anything is saved. The server
 * validates and recalculates again on save.
 */

type EditorData = { trip: StoredTrip & { id: string }; rules: Rule[]; today: ISODate };
type Prefill = { arrivalDate: ISODate; returnDate: ISODate | null };

const EditorContext = createContext<{ open: (prefill?: Prefill) => void } | null>(null);

export function useTripEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useTripEditor must be used inside <TripEditorProvider>.");
  return ctx;
}

export function TripEditorProvider({ children, ...data }: EditorData & { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; prefill?: Prefill; key: number }>({ open: false, key: 0 });
  const open = useCallback((prefill?: Prefill) => setState((s) => ({ open: true, prefill, key: s.key + 1 })), []);
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);
  const value = useMemo(() => ({ open }), [open]);
  return (
    <EditorContext.Provider value={value}>
      {children}
      <EditDatesDialog key={state.key} open={state.open} onClose={close} prefill={state.prefill} {...data} />
    </EditorContext.Provider>
  );
}

/** Opens the edit dialog, optionally with dates already filled in (e.g. a suggested fix). */
export function EditDatesButton({
  prefill,
  children = "Edit dates",
  variant = "secondary",
  size = "md",
  className,
}: {
  prefill?: Prefill;
  children?: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "accent";
  size?: "sm" | "md";
  className?: string;
}) {
  const { open } = useTripEditor();
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      iconLeft={<CalendarClock className="size-4" />}
      onClick={() => open(prefill)}
    >
      {children}
    </Button>
  );
}

const CHANGE_ICON: Record<PlanChange["kind"], ReactNode> = {
  "now-blocked": <Lock className="size-3.5 text-danger-700" />,
  unblocked: <Unlock className="size-3.5 text-ok-700" />,
  moved: <MoveRight className="size-3.5 text-info-700" />,
  added: <Plus className="size-3.5 text-forest-800" />,
  removed: <CircleSlash className="size-3.5 text-ink-400" />,
};

function ChangeLine({ change }: { change: PlanChange }) {
  return (
    <li data-kind={change.kind} className="flex gap-2.5 py-2 text-[13px]">
      <span className="mt-0.5 shrink-0">{CHANGE_ICON[change.kind]}</span>
      <div className="min-w-0">
        <p className="font-medium text-ink-900">
          {change.title}
          {change.pets && <span className="font-normal text-ink-500"> · {change.pets}</span>}
        </p>
        <p className="tabular text-ink-500">
          {change.kind === "moved" ? (
            <>
              <span className="line-through decoration-ink-400/60">{change.before ?? "No date"}</span>
              <ArrowRight className="mx-1 inline size-3" aria-label="now" />
              <span className="font-medium text-ink-700">{change.after ?? "No date"}</span>
            </>
          ) : change.kind === "now-blocked" ? (
            "Can't be done in time for these dates"
          ) : change.kind === "unblocked" ? (
            `Possible again${change.after ? `: ${change.after}` : ""}`
          ) : change.kind === "added" ? (
            "New step for these dates"
          ) : (
            "No longer needed"
          )}
        </p>
      </div>
    </li>
  );
}

function EditDatesDialog({
  open,
  onClose,
  prefill,
  trip,
  rules,
  today,
}: EditorData & { open: boolean; onClose: () => void; prefill?: Prefill }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [arrival, setArrival] = useState<string>(prefill?.arrivalDate ?? trip.arrivalDate);
  const initialReturn = prefill ? prefill.returnDate : trip.returnDate;
  const [ret, setRet] = useState<string>(initialReturn ?? "");
  const [noReturn, setNoReturn] = useState(!initialReturn);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const input = { arrivalDate: arrival, returnDate: noReturn ? "" : ret, noReturnYet: noReturn };
  const unchanged = arrival === trip.arrivalDate && (noReturn ? null : ret || null) === trip.returnDate;

  const preview = useMemo(() => {
    const parsed = tripDatesSchema(today).safeParse(input);
    if (!parsed.success) return { errors: issuesToErrors(parsed.error) } as const;
    const next = { ...trip, arrivalDate: parsed.data.arrivalDate, returnDate: noReturn ? null : (parsed.data.returnDate ?? null) };
    try {
      const before = planStoredTrip(trip, today, rules);
      const after = planStoredTrip(next, today, rules);
      return { diff: diffPlans(before, after, today), after, suggestion: suggestDates(next, after.pets, today) } as const;
    } catch {
      return { errors: { arrivalDate: "These dates can't be planned." } } as const;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrival, ret, noReturn, trip, rules, today]);

  const errors = { ...("errors" in preview ? preview.errors : {}), ...serverErrors };
  const diff = "diff" in preview ? preview.diff : null;
  const afterPlan = "after" in preview ? preview.after : null;
  const suggestion: DateSuggestion | null = "suggestion" in preview ? (preview.suggestion ?? null) : null;
  const blockers = afterPlan?.pets.flatMap(({ pet, plan }) =>
    plan.supported ? plan.blockers.map((b) => (afterPlan.pets.length > 1 ? `${pet.name}: ${b.message}` : b.message)) : [],
  );
  const shown = diff?.changes.slice(0, 6) ?? [];
  const hidden = (diff?.changes.length ?? 0) - shown.length;

  function applySuggestion(s: DateSuggestion) {
    setArrival(s.arrivalDate);
    if (s.returnDate) {
      setRet(s.returnDate);
      setNoReturn(false);
    }
    setServerErrors({});
  }

  function save() {
    setMessage(null);
    start(async () => {
      const result = await changeTripDates(trip.id, input);
      if (result.ok) {
        toast({ title: "Dates updated", detail: "Your plan has been recalculated for the new dates." });
        onClose();
      } else {
        setServerErrors(result.errors ?? {});
        setMessage(result.message ?? null);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Change your travel dates"
      description="Every deadline is worked out again from the new dates."
      className="sm:max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={pending} disabled={unchanged || "errors" in preview}>
            Save new dates
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          type="date"
          label="Date your pet arrives"
          value={arrival}
          min={today}
          onChange={(e) => {
            setArrival(e.target.value);
            setServerErrors({});
          }}
          error={errors.arrivalDate}
        />
        <Input
          type="date"
          label="Date you come home"
          value={noReturn ? "" : ret}
          min={arrival || today}
          disabled={noReturn}
          onChange={(e) => {
            setRet(e.target.value);
            setServerErrors({});
          }}
          error={noReturn ? undefined : errors.returnDate}
        />
      </div>
      <div className="mt-3">
        <Checkbox label="I don't know my return date yet" checked={noReturn} onChange={setNoReturn} />
      </div>
      {message && (
        <p role="alert" className="mt-3 text-[13px] text-danger-700">
          {message}
        </p>
      )}

      <section
        aria-label="Preview of your plan"
        aria-live="polite"
        data-testid="dates-preview"
        className="mt-5 rounded-card border border-line bg-cream-50 p-4"
      >
        {!diff ? (
          <p className="text-[13px] text-ink-500">Enter valid dates to see how your plan changes.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="font-medium text-ink-700">Plan status</span>
              {diff.statusBefore !== diff.statusAfter ? (
                <>
                  <TripStatusBadge status={diff.statusBefore} />
                  <ArrowRight className="size-3.5 text-ink-400" aria-label="becomes" />
                </>
              ) : null}
              <span data-testid="preview-status" data-status={diff.statusAfter}>
                <TripStatusBadge status={diff.statusAfter} />
              </span>
            </div>

            {blockers && blockers.length > 0 && (
              <div className="mt-3 rounded-control border border-danger-700/15 bg-danger-100 p-3 text-[13px] text-danger-700">
                <p className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="size-4" /> These dates still don&apos;t work
                </p>
                <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5 text-ink-700">
                  {blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                {suggestion && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2.5"
                    onClick={() => applySuggestion(suggestion)}
                  >
                    Use {formatDate(suggestion.arrivalDate)}
                    {suggestion.returnDate && suggestion.returnDate !== (noReturn ? null : ret)
                      ? ` – ${formatDate(suggestion.returnDate)}`
                      : ""}
                  </Button>
                )}
              </div>
            )}

            {unchanged ? (
              <p className="mt-3 text-[13px] text-ink-500">These are your current dates.</p>
            ) : shown.length === 0 ? (
              <p className="mt-3 flex items-center gap-1.5 text-[13px] text-ink-700">
                <CheckCircle2 className="size-4 text-ok-700" /> No deadlines move with these dates.
              </p>
            ) : (
              <>
                <p className="mt-3 text-[13px] font-medium text-ink-700">What changes</p>
                <ul className={cn("mt-1 divide-y divide-line")} data-testid="preview-changes">
                  {shown.map((c) => (
                    <ChangeLine key={`${c.kind}-${c.taskId}-${c.pets}`} change={c} />
                  ))}
                </ul>
                {hidden > 0 && <p className="mt-1 text-[12px] text-ink-500">and {hidden} more</p>}
              </>
            )}
          </>
        )}
      </section>
    </Dialog>
  );
}
