"use client";

import { AlertTriangle, CheckCircle2, Quote, ShieldAlert, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { changeDocumentTypeAction, confirmDocumentAction, deleteDocumentAction } from "@/app/actions/documents";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import {
  CONFIDENT,
  DOC_TYPES,
  DOC_TYPE_LABEL,
  FIELD_SPECS,
  TRIP_TYPES,
  checkFields,
  isDocType,
  type FieldIssue,
  type FieldKey,
  type PetProfile,
} from "@/lib/documents/extract";

export type ReviewField = {
  key: string;
  value: string | null;
  raw: string | null;
  confidence: number;
  evidence: string | null;
  page: number | null;
  origin: string;
};

type TripOption = { id: string; label: string };

function ConfidenceTag({ field, edited }: { field?: ReviewField; edited: boolean }) {
  let label: string;
  let tone: string;
  if (edited || (field && field.origin !== "EXTRACTED")) {
    label = field?.origin === "MANUAL" || !field?.value ? "Typed by you" : "Edited by you";
    tone = "bg-sage-100 text-forest-800";
  } else if (!field?.value) {
    label = "Not found";
    tone = "bg-cream-200 text-ink-500";
  } else if (field.confidence >= CONFIDENT) {
    label = `Read clearly · ${Math.round(field.confidence * 100)}%`;
    tone = "bg-ok-100 text-ok-700";
  } else {
    label = `Check this · ${Math.round(field.confidence * 100)}%`;
    tone = "bg-warn-100 text-warn-700";
  }
  return <span className={cn("tabular inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium", tone)}>{label}</span>;
}

export function ReviewForm({
  doc,
  fields,
  pet,
  trips,
  today,
}: {
  doc: { id: string; type: string; status: string; readMode: string; typeConfidence: number; tripId: string | null };
  fields: ReviewField[];
  pet: PetProfile & { id: string };
  trips: TripOption[];
  today: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const type = isDocType(doc.type) ? doc.type : "OTHER";
  const specs = FIELD_SPECS[type];
  const initial = useMemo(() => Object.fromEntries(specs.map((s) => [s.key, fields.find((f) => f.key === s.key)?.value ?? ""])), [specs, fields]);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [tripId, setTripId] = useState(doc.tripId ?? trips[0]?.id ?? "");
  const [ack, setAck] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* The same checks the server runs, re-run as the owner edits */
  const issues: FieldIssue[] = useMemo(() => {
    const current = specs.map((s) => {
      const f = fields.find((x) => x.key === s.key);
      const v = values[s.key]?.trim() || null;
      const edited = (v ?? "") !== (f?.value ?? "");
      return { key: s.key as FieldKey, value: s.kind === "chip" && v ? v.replace(/\s/g, "") : v, confidence: edited || f?.origin !== "EXTRACTED" ? 1 : (f?.confidence ?? 0) };
    });
    return checkFields(type, current, pet, today, {
      typeConfidence: doc.readMode === "TEXT" ? doc.typeConfidence : undefined,
      readable: doc.readMode === "TEXT",
    });
  }, [values, specs, fields, type, pet, today, doc.readMode, doc.typeConfidence]);

  const blocking = issues.filter((i) => i.level === "block");
  const checks = issues.filter((i) => i.level === "check");
  const typeIssue = issues.find((i) => i.key === "type");
  const needsTrip = TRIP_TYPES.includes(type);

  function changeType(next: string) {
    setMessage(null);
    start(async () => {
      const r = await changeDocumentTypeAction(doc.id, next);
      if (!r.ok) setMessage(r.message ?? "Couldn't change the type.");
      else router.refresh();
    });
  }

  function confirm() {
    setErrors({});
    setMessage(null);
    start(async () => {
      const r = await confirmDocumentAction(doc.id, { fields: values, tripId: needsTrip ? tripId : null, acknowledged: ack });
      if (r.ok) {
        toast({ title: "Details confirmed", detail: r.applied[0] });
        router.refresh();
      } else {
        setErrors(r.errors ?? {});
        setMessage(r.message ?? null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6" data-testid="review-form">
      <Select
        label="Document type"
        value={type}
        onChange={(e) => changeType(e.target.value)}
        disabled={pending}
        hint={
          doc.readMode === "TEXT" && doc.typeConfidence < 1
            ? type === "OTHER"
              ? "We couldn't tell what this is. Choose a type to read its details."
              : `Worked out from the document's text (${Math.round(doc.typeConfidence * 100)}% sure). Change it if it's wrong.`
            : undefined
        }
      >
        {DOC_TYPES.map((t) => (
          <option key={t} value={t}>
            {DOC_TYPE_LABEL[t]}
          </option>
        ))}
      </Select>

      {typeIssue && (
        <p className="flex gap-2 rounded-control bg-warn-100 p-3 text-[13px] text-warn-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {typeIssue.message}
        </p>
      )}

      {type === "OTHER" ? (
        <p className="text-sm text-ink-500">
          Stored in your vault. Other documents aren&apos;t read, so they don&apos;t change your plan.
        </p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-line rounded-card border border-line bg-surface" aria-label="Details from the document">
            {specs.map((spec) => {
              const field = fields.find((f) => f.key === spec.key);
              const value = values[spec.key] ?? "";
              const edited = value !== (field?.value ?? "");
              const fieldIssues = issues.filter((i) => i.key === spec.key);
              const error = errors[spec.key] ?? fieldIssues.find((i) => i.level === "block")?.message;
              const id = `field-${spec.key}`;
              return (
                <li key={spec.key} className="p-4" data-testid={id} data-confidence={field?.confidence ?? 0}>
                  {spec.kind === "dose" ? (
                    <Select id={id} label={spec.label} value={value} onChange={(e) => setValues((v) => ({ ...v, [spec.key]: e.target.value }))}>
                      <option value="">Not stated</option>
                      <option value="PRIMARY">First (primary) vaccination</option>
                      <option value="BOOSTER">Booster, with no break in cover</option>
                    </Select>
                  ) : (
                    <Input
                      id={id}
                      label={spec.label}
                      optional={!spec.required}
                      type={spec.kind === "date" ? "date" : spec.kind === "time" ? "time" : "text"}
                      inputMode={spec.kind === "chip" ? "numeric" : undefined}
                      value={value}
                      onChange={(e) => setValues((v) => ({ ...v, [spec.key]: e.target.value }))}
                      error={error}
                    />
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <ConfidenceTag field={field} edited={edited} />
                    {field?.evidence && !edited && (
                      <span className="inline-flex min-w-0 items-center gap-1 text-[12px] text-ink-500" data-testid={`${id}-evidence`}>
                        <Quote className="size-3 shrink-0 text-ink-400" />
                        <span className="truncate">&ldquo;{field.evidence}&rdquo;</span>
                        {field.page && <span className="shrink-0 text-ink-400">· page {field.page}</span>}
                      </span>
                    )}
                  </div>
                  {fieldIssues
                    .filter((i) => i.level === "check")
                    .map((i) => (
                      <p key={i.message} className="mt-2 flex gap-1.5 text-[13px] text-warn-700" data-testid={`${id}-check`}>
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                        {i.message}
                      </p>
                    ))}
                </li>
              );
            })}
          </ul>

          {needsTrip && (
            <Select
              label="Which trip is this for?"
              value={tripId}
              onChange={(e) => setTripId(e.target.value)}
              error={errors.tripId}
              hint={trips.length ? undefined : `${pet.name} isn't on a trip yet. Plan one first.`}
            >
              {trips.length === 0 && <option value="">No trips</option>}
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          )}

          <div className="flex flex-col gap-4 rounded-card border border-line bg-cream-50 p-5">
            {blocking.length > 0 ? (
              <p className="flex gap-2 text-[13px] font-medium text-danger-700">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                Fix {blocking.length === 1 ? "the highlighted detail" : `the ${blocking.length} highlighted details`} before confirming.
              </p>
            ) : checks.length > 0 ? (
              <Checkbox
                label={`I've checked the ${checks.length === 1 ? "flagged detail" : `${checks.length} flagged details`} against the original document`}
                description="Confirming uses these details in your plan."
                checked={ack}
                onChange={setAck}
              />
            ) : (
              <p className="flex gap-2 text-[13px] text-ok-700">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                Everything was read clearly and matches {pet.name}&apos;s profile.
              </p>
            )}
            {(errors.acknowledged || message) && (
              <p role="alert" className="text-[13px] text-danger-700">
                {errors.acknowledged ?? message}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="ghost"
                className="text-danger-700 hover:bg-danger-100 hover:text-danger-700"
                iconLeft={<Trash2 className="size-4" />}
                onClick={() => setDeleting(true)}
              >
                Delete
              </Button>
              <Button
                onClick={confirm}
                loading={pending}
                disabled={blocking.length > 0 || (checks.length > 0 && !ack) || (needsTrip && !tripId)}
                iconLeft={<CheckCircle2 className="size-4" />}
              >
                Looks right, confirm
              </Button>
            </div>
          </div>
        </>
      )}

      {type === "OTHER" && (
        <div>
          <Button
            variant="ghost"
            className="text-danger-700 hover:bg-danger-100 hover:text-danger-700"
            iconLeft={<Trash2 className="size-4" />}
            onClick={() => setDeleting(true)}
          >
            Delete
          </Button>
          {message && <p role="alert" className="mt-2 text-[13px] text-danger-700">{message}</p>}
        </div>
      )}

      <DeleteDocumentDialog id={doc.id} open={deleting} onClose={() => setDeleting(false)} confirmed={false} />
    </div>
  );
}

export function DeleteDocumentDialog({
  id,
  open,
  onClose,
  confirmed,
}: {
  id: string;
  open: boolean;
  onClose: () => void;
  confirmed: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Delete this document?"
      description="The file is removed from your vault for good."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep it
          </Button>
          <Button variant="danger" loading={pending} onClick={() => start(() => deleteDocumentAction(id).then(() => undefined))}>
            Delete document
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-700">
        {confirmed
          ? "Any trip step it completed goes back to to-do. Details it added to your pet's profile stay, so you can keep or edit them in My pets."
          : "This can't be undone."}
      </p>
    </Dialog>
  );
}

export function DeleteDocumentButton({ id, confirmed }: { id: string; confirmed: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        className="text-danger-700 hover:bg-danger-100 hover:text-danger-700"
        iconLeft={<Trash2 className="size-4" />}
        onClick={() => setOpen(true)}
      >
        Delete document
      </Button>
      <DeleteDocumentDialog id={id} open={open} onClose={() => setOpen(false)} confirmed={confirmed} />
    </>
  );
}
