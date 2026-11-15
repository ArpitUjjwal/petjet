import type { ISODate } from "@/lib/rules/dates";
import type { PlanTask, TaskRecords } from "@/lib/rules/types";

/*
 * Steps an owner can confirm themselves, and how stored task records become engine input.
 * Vet and lab steps (certificates, treatments) are deliberately absent: they complete from
 * documents and provider records in later modules, never from an owner's tick.
 */

export type RecordKey = keyof TaskRecords;

/** How each engine record is stored: "date" keys feed a date to the engine, "flag" keys a yes. */
export const RECORD_KIND: Record<RecordKey, "date" | "flag"> = {
  ahcIssuedOn: "date",
  tapewormOutboundOn: "date",
  irelandNoticeGiven: "flag",
  cdcFormSubmittedOn: "date",
  pedigreeCarried: "flag",
  returnCertificateIssuedOn: "date",
  tapewormReturnOn: "date",
  approvedRouteBooked: "flag",
  authorisedDeclarationSigned: "flag",
};

export type OwnerStep = {
  key: RecordKey;
  /** Question in the confirm dialog */
  question: string;
  /** Label for the date field */
  dateLabel: string;
  /** Short past-tense label shown on a done task, followed by the date */
  doneLabel: string;
};

export const OWNER_STEPS: Record<string, OwnerStep> = {
  "ireland-notice": {
    key: "irelandNoticeGiven",
    question: "Have you told the Irish point of entry you're coming?",
    dateLabel: "Date you gave notice",
    doneLabel: "Notice given",
  },
  "cdc-form": {
    key: "cdcFormSubmittedOn",
    question: "Have you submitted the CDC Dog Import Form?",
    dateLabel: "Date on the receipt",
    doneLabel: "Submitted",
  },
  "france-breed": {
    key: "pedigreeCarried",
    question: "Is the pedigree certificate packed with your travel documents?",
    dateLabel: "Date you checked",
    doneLabel: "Packed",
  },
  "return-approved-route": {
    key: "approvedRouteBooked",
    question: "Have you booked an approved route home with your pet as cargo?",
    dateLabel: "Date you booked",
    doneLabel: "Booked",
  },
  "authorised-person": {
    key: "authorisedDeclarationSigned",
    question: "Have you signed the declaration for the person travelling with your pet?",
    dateLabel: "Date you signed",
    doneLabel: "Signed",
  },
};

/** The owner-confirmable step behind a task, when the task is in a state an owner can change. */
export function ownerStep(task: Pick<PlanTask, "id" | "status">): OwnerStep | null {
  const step = OWNER_STEPS[task.id];
  if (!step) return null;
  /* A VERIFY or BLOCKED variant of the same id (e.g. "confirm the pedigree") isn't a tick-box */
  return task.status === "TODO" || task.status === "DONE" ? step : null;
}

export type StoredRecord = { key: string; doneOn: string; source: string };

function isRecordKey(key: string): key is RecordKey {
  return key in RECORD_KIND;
}

/** Engine records for one pet from its stored rows. Unknown keys are ignored. */
export function toTaskRecords(rows: StoredRecord[]): TaskRecords {
  const out: TaskRecords = {};
  for (const row of rows) {
    if (!isRecordKey(row.key)) continue;
    if (RECORD_KIND[row.key] === "flag") (out as Record<string, unknown>)[row.key] = true;
    else (out as Record<string, unknown>)[row.key] = row.doneOn as ISODate;
  }
  return out;
}

/** Records for a trip, grouped by pet, ready for planTrip's `records` option. */
export function recordsByPet(rows: (StoredRecord & { petId: string })[]) {
  const map = new Map<string, TaskRecords>();
  for (const pet of new Set(rows.map((r) => r.petId))) {
    map.set(pet, toTaskRecords(rows.filter((r) => r.petId === pet)));
  }
  return (petId: string) => map.get(petId);
}
