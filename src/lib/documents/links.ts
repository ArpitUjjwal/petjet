import type { DocType } from "./extract";

/* Which plan steps a document type completes, so the checklist can link the two both ways. */
export const TASK_DOC_TYPE: Record<string, Exclude<DocType, "OTHER">> = {
  microchip: "MICROCHIP",
  rabies: "RABIES",
  "rabies-booster": "RABIES",
  ahc: "AHC",
  "return-document": "AHC",
  "tapeworm-outbound": "TAPEWORM",
  "tapeworm-return": "TAPEWORM",
  "cdc-form": "CDC_RECEIPT",
};

export const RECORD_TASK: Record<string, string[]> = {
  ahcIssuedOn: ["ahc", "return-document"],
  tapewormOutboundOn: ["tapeworm-outbound"],
  tapewormReturnOn: ["tapeworm-return"],
  cdcFormSubmittedOn: ["cdc-form"],
};

export type Evidence = { id: string; fileName: string };

/**
 * The document behind each step for one pet on one trip: profile documents (rabies, microchip)
 * by type, trip documents through the step record they created.
 */
export function evidenceFor(
  pet: { id: string; rabiesLastDose: string | null; microchipNumber: string | null },
  docs: { id: string; petId: string; type: string; fileName: string; fields?: { key: string; value: string | null }[] }[],
  records: { petId: string; key: string; documentId?: string | null }[],
): Record<string, Evidence> {
  const out: Record<string, Evidence> = {};
  const petId = pet.id;
  const field = (d: (typeof docs)[number], key: string) => d.fields?.find((f) => f.key === key)?.value ?? null;
  for (const d of docs) {
    if (d.petId !== petId) continue;
    /* Only the document the profile's current details came from, not an older one kept for reference */
    if (d.type === "RABIES" && !out.rabies && pet.rabiesLastDose && field(d, "vaccinationDate") === pet.rabiesLastDose) {
      out.rabies = { id: d.id, fileName: d.fileName };
    }
    if (d.type === "MICROCHIP" && !out.microchip && pet.microchipNumber && field(d, "microchipNumber") === pet.microchipNumber) {
      out.microchip = { id: d.id, fileName: d.fileName };
    }
  }
  for (const r of records) {
    if (r.petId !== petId || !r.documentId) continue;
    const doc = docs.find((d) => d.id === r.documentId);
    if (!doc) continue;
    for (const task of RECORD_TASK[r.key] ?? []) out[task] = { id: doc.id, fileName: doc.fileName };
  }
  return out;
}
