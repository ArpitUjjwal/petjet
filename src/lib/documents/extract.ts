import { isAfter, isBefore, isISODate, type ISODate } from "@/lib/rules/dates";

/*
 * PetJet's simulated document reader. Pure and deterministic: it classifies a document from
 * its text, then finds each field next to its label, recording how sure it is and the exact
 * line it came from. It never invents a value: a field it can't find is left empty for the
 * owner to fill in. Nothing here authenticates a certificate.
 */

export const DOC_TYPES = ["RABIES", "MICROCHIP", "AHC", "TAPEWORM", "CDC_RECEIPT", "OTHER"] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  RABIES: "Rabies vaccination record",
  MICROCHIP: "Microchip certificate",
  AHC: "Animal health certificate",
  TAPEWORM: "Tapeworm treatment record",
  CDC_RECEIPT: "CDC Dog Import Form receipt",
  OTHER: "Other document",
};

export function isDocType(v: unknown): v is DocType {
  return typeof v === "string" && (DOC_TYPES as readonly string[]).includes(v);
}

/** Types whose details complete a step on a specific trip, rather than the pet's profile */
export const TRIP_TYPES: DocType[] = ["AHC", "TAPEWORM", "CDC_RECEIPT"];

export type FieldKey =
  | "petName"
  | "species"
  | "microchipNumber"
  | "dateOfBirth"
  | "vaccinationDate"
  | "validUntil"
  | "doseKind"
  | "vaccine"
  | "implantDate"
  | "certificateNumber"
  | "destination"
  | "issuedOn"
  | "treatedOn"
  | "treatedAt"
  | "product"
  | "submittedOn"
  | "confirmationNumber";

export type FieldKind = "text" | "date" | "chip" | "time" | "dose";

type FieldSpec = {
  key: FieldKey;
  label: string;
  kind: FieldKind;
  required?: boolean;
  /** Labels as they appear on real documents, most specific first */
  labels: RegExp[];
};

const L = {
  petName: [/animal name/i, /pet(?:'s)? name/i, /dog name/i, /cat name/i, /\bname of animal/i, /\bname\b/i],
  species: [/species/i],
  chip: [/microchip (?:number|no\.?|code)/i, /transponder (?:number|code|no\.?)/i, /chip number/i, /microchip/i],
  dob: [/date of birth/i, /\bd\.?o\.?b\.?/i, /born/i],
};

export const FIELD_SPECS: Record<DocType, FieldSpec[]> = {
  RABIES: [
    { key: "vaccinationDate", label: "Date of vaccination", kind: "date", required: true, labels: [/date of vaccination/i, /vaccinat(?:ion|ed) (?:date|on)/i, /date administered/i, /date given/i] },
    { key: "validUntil", label: "Valid until", kind: "date", labels: [/valid until/i, /valid to/i, /expir(?:y|es)(?: date)?/i, /next (?:booster|vaccination) due/i] },
    { key: "doseKind", label: "Dose", kind: "dose", labels: [/vaccination type/i, /dose type/i, /type of vaccination/i] },
    { key: "vaccine", label: "Vaccine", kind: "text", labels: [/vaccine(?: name)?/i, /product/i] },
    { key: "microchipNumber", label: "Microchip number", kind: "chip", labels: L.chip },
    { key: "petName", label: "Pet's name", kind: "text", labels: L.petName },
    { key: "species", label: "Species", kind: "text", labels: L.species },
  ],
  MICROCHIP: [
    { key: "microchipNumber", label: "Microchip number", kind: "chip", required: true, labels: L.chip },
    { key: "implantDate", label: "Date implanted", kind: "date", labels: [/date of implant(?:ation)?/i, /implant(?:ed|ation)? (?:date|on)/i, /date (?:chipped|of chipping)/i] },
    { key: "petName", label: "Pet's name", kind: "text", labels: L.petName },
    { key: "species", label: "Species", kind: "text", labels: L.species },
    { key: "dateOfBirth", label: "Date of birth", kind: "date", labels: L.dob },
  ],
  AHC: [
    { key: "issuedOn", label: "Date of issue", kind: "date", required: true, labels: [/date of issue/i, /issued on/i, /date of signature/i, /date signed/i, /issue date/i] },
    { key: "certificateNumber", label: "Certificate reference", kind: "text", labels: [/certificate (?:reference|number|no\.?)/i, /reference number/i] },
    { key: "destination", label: "Country of destination", kind: "text", labels: [/country of destination/i, /destination/i] },
    { key: "microchipNumber", label: "Microchip number", kind: "chip", labels: L.chip },
    { key: "petName", label: "Pet's name", kind: "text", labels: L.petName },
  ],
  TAPEWORM: [
    { key: "treatedOn", label: "Date of treatment", kind: "date", required: true, labels: [/date of treatment/i, /treat(?:ed|ment) (?:on|date)/i, /date administered/i, /date given/i] },
    { key: "treatedAt", label: "Time of treatment", kind: "time", labels: [/time of treatment/i, /time (?:given|administered)/i, /\btime\b/i] },
    { key: "product", label: "Product", kind: "text", labels: [/product/i, /medicine/i, /treatment used/i] },
    { key: "microchipNumber", label: "Microchip number", kind: "chip", labels: L.chip },
    { key: "petName", label: "Pet's name", kind: "text", labels: L.petName },
  ],
  CDC_RECEIPT: [
    { key: "submittedOn", label: "Submission date", kind: "date", required: true, labels: [/submission date/i, /date submitted/i, /submitted on/i, /date of submission/i] },
    { key: "confirmationNumber", label: "Confirmation number", kind: "text", labels: [/confirmation (?:number|no\.?|code)/i, /receipt (?:number|no\.?)/i] },
    { key: "microchipNumber", label: "Microchip number", kind: "chip", labels: L.chip },
    { key: "petName", label: "Dog's name", kind: "text", labels: L.petName },
  ],
  OTHER: [],
};

export function fieldSpec(type: DocType, key: string) {
  return FIELD_SPECS[type].find((f) => f.key === key);
}

/* ---------- Classification ---------- */

const SIGNALS: Record<Exclude<DocType, "OTHER">, [RegExp, number][]> = {
  RABIES: [[/rabies/i, 3], [/anti-rabies/i, 2], [/vaccinat/i, 2], [/valid until/i, 1], [/batch/i, 1], [/nobivac|rabisin|versiguard|defensor/i, 1]],
  MICROCHIP: [[/microchip (?:registration|certificate)|certificate of microchip/i, 5], [/implant/i, 2], [/transponder/i, 2], [/iso 11784/i, 2], [/database/i, 1]],
  AHC: [[/animal health certificate/i, 6], [/official veterinarian/i, 2], [/non-commercial movement/i, 2], [/country of destination/i, 1], [/\bEU\b/, 1]],
  TAPEWORM: [[/tapeworm/i, 4], [/echinococcus/i, 4], [/praziquantel/i, 3], [/droncit|milbemax|drontal/i, 1]],
  CDC_RECEIPT: [[/cdc dog import form/i, 6], [/centers for disease control/i, 2], [/confirmation number/i, 1], [/receipt/i, 1]],
};

export type Classification = { type: DocType; confidence: number; scores: Partial<Record<DocType, number>> };

/** Scores each type by its tell-tale phrases; the document title (first lines) counts double. */
export function classify(pages: string[]): Classification {
  const text = pages.join("\n");
  const head = text.split("\n").slice(0, 4).join("\n");
  const scores: Partial<Record<DocType, number>> = {};
  for (const [type, signals] of Object.entries(SIGNALS) as [DocType, [RegExp, number][]][]) {
    let s = 0;
    for (const [re, w] of signals) {
      if (re.test(text)) s += w;
      if (re.test(head)) s += w;
    }
    scores[type] = s;
  }
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]) as [DocType, number][];
  const [best, second] = ranked;
  if (!best || best[1] < 4) return { type: "OTHER", confidence: 0, scores };
  /* Sure when the winner is strong and well clear of the runner-up */
  const margin = best[1] - (second?.[1] ?? 0);
  const confidence = Math.min(0.99, Math.round((0.5 + Math.min(best[1], 16) / 40 + Math.min(margin, 10) / 40) * 100) / 100);
  return { type: best[0], confidence, scores };
}

/* ---------- Value parsing ---------- */

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function iso(y: number, m: number, d: number): ISODate | null {
  const s = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return isISODate(s) ? s : null;
}

export type ParsedDate = { iso: ISODate; raw: string; ambiguous: boolean };

/**
 * Finds the first date in a string. Numeric dates are read day-first (UK documents) unless
 * `order` is "MDY" (US documents); when both readings are possible the result is ambiguous.
 */
export function parseDate(text: string, order: "DMY" | "MDY" = "DMY"): ParsedDate | null {
  let m = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(text);
  if (m) {
    const v = iso(+m[1], +m[2], +m[3]);
    if (v) return { iso: v, raw: m[0], ambiguous: false };
  }
  m = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/.exec(text);
  if (m) {
    const [a, b, y] = [+m[1], +m[2], +m[3]];
    const [d, mo] = order === "DMY" ? [a, b] : [b, a];
    const v = iso(y, mo, d);
    if (v) return { iso: v, raw: m[0], ambiguous: a <= 12 && b <= 12 && a !== b };
    const swapped = iso(y, d, mo);
    if (swapped) return { iso: swapped, raw: m[0], ambiguous: false };
  }
  m = /\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/.exec(text);
  if (m) {
    const mo = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
    const v = mo ? iso(+m[3], mo, +m[1]) : null;
    if (v) return { iso: v, raw: m[0], ambiguous: false };
  }
  m = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/.exec(text);
  if (m) {
    const mo = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
    const v = mo ? iso(+m[3], mo, +m[2]) : null;
    if (v) return { iso: v, raw: m[0], ambiguous: false };
  }
  return null;
}

/** ISO microchips are 15 digits, often printed in groups. */
export function parseChip(text: string): { value: string; raw: string; standard: boolean } | null {
  const m = /(?<![\d])(\d[\d ]{13,20}\d)(?![\d])/.exec(text);
  if (m) {
    const digits = m[1].replace(/\s/g, "");
    if (digits.length === 15) return { value: digits, raw: m[1], standard: true };
  }
  const old = /\b([0-9A-F]{9,10})\b/i.exec(text);
  if (old && /\d/.test(old[1])) return { value: old[1].toUpperCase(), raw: old[1], standard: false };
  return null;
}

function parseTime(text: string) {
  const m = /\b([01]?\d|2[0-3])[:.]([0-5]\d)\s*(am|pm)?\b/i.exec(text);
  if (!m) return null;
  let h = +m[1];
  const ap = m[3]?.toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return { value: `${String(h).padStart(2, "0")}:${m[2]}`, raw: m[0] };
}

function parseDose(text: string) {
  if (/booster|revaccination|no lapse/i.test(text)) return { value: "BOOSTER", raw: text.trim() };
  if (/primary|first/i.test(text)) return { value: "PRIMARY", raw: text.trim() };
  return null;
}

/* ---------- Field extraction ---------- */

export type ExtractedField = {
  key: FieldKey;
  value: string | null;
  /** The text as printed */
  raw: string | null;
  /** 0 to 1 */
  confidence: number;
  /** The line the value came from */
  evidence: string | null;
  page: number | null;
};

type Line = { text: string; page: number };

function linesOf(pages: string[]): Line[] {
  return pages.flatMap((p, i) =>
    p
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((text) => ({ text, page: i + 1 })),
  );
}

/** Text after a label on its line, up to the next "Label:" on the same line. */
function afterLabel(line: string, label: RegExp) {
  const m = label.exec(line);
  if (!m) return null;
  let rest = line.slice(m.index + m[0].length).replace(/^\s*[:\-–#]?\s*/, "");
  const next = /\s{2,}[A-Z][A-Za-z ]{1,30}:|\s+[A-Z][a-z]+(?: [a-z]+)*:\s/.exec(rest);
  if (next) rest = rest.slice(0, next.index);
  return rest.trim();
}

function parseValue(kind: FieldKind, text: string, order: "DMY" | "MDY", orderSure = false) {
  switch (kind) {
    case "date": {
      const d = parseDate(text, order);
      return d ? { value: d.iso, raw: d.raw, sure: !d.ambiguous || orderSure } : null;
    }
    case "chip": {
      const c = parseChip(text);
      return c ? { value: c.value, raw: c.raw, sure: c.standard } : null;
    }
    case "time": {
      const t = parseTime(text);
      return t ? { ...t, sure: true } : null;
    }
    case "dose": {
      const d = parseDose(text);
      return d ? { ...d, sure: true } : null;
    }
    default: {
      const v = text.replace(/\s+/g, " ").trim();
      return v && v.length <= 80 ? { value: v, raw: v, sure: true } : null;
    }
  }
}

/**
 * Which way round this document writes numeric dates. UK vet documents are day-first and CDC
 * receipts month-first; a date that can only be read one way (25/12 or 12/25) confirms it.
 * Conflicting dates leave it unsure, and every numeric date then needs checking.
 */
export function dateOrder(type: DocType, pages: string[]): { order: "DMY" | "MDY"; sure: boolean } {
  const fallback = type === "CDC_RECEIPT" ? "MDY" : "DMY";
  let dmy = false;
  let mdy = false;
  for (const m of pages.join("\n").matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/g)) {
    if (+m[1] > 12 && +m[2] <= 12) dmy = true;
    if (+m[2] > 12 && +m[1] <= 12) mdy = true;
  }
  if (dmy && mdy) return { order: fallback, sure: false };
  if (dmy) return { order: "DMY", sure: true };
  if (mdy) return { order: "MDY", sure: true };
  return { order: fallback, sure: true };
}

export function extractFields(type: DocType, pages: string[]): ExtractedField[] {
  const lines = linesOf(pages);
  const { order, sure: orderSure } = dateOrder(type, pages);
  return FIELD_SPECS[type].map((spec) => {
    /* 1. Next to a label: the usual case */
    for (const label of spec.labels) {
      for (const line of lines) {
        const rest = afterLabel(line.text, label);
        if (rest === null) continue;
        const parsed = parseValue(spec.kind, rest, order, orderSure);
        if (!parsed) continue;
        return {
          key: spec.key,
          value: parsed.value,
          raw: parsed.raw,
          confidence: parsed.sure ? 0.95 : 0.7,
          evidence: line.text,
          page: line.page,
        };
      }
    }
    /* 2. Without a label, only for values with a distinctive shape */
    if (spec.kind === "chip" || (spec.kind === "dose" && type === "RABIES")) {
      for (const line of lines) {
        const parsed = parseValue(spec.kind, line.text, order);
        if (parsed) {
          return { key: spec.key, value: parsed.value, raw: parsed.raw, confidence: 0.6, evidence: line.text, page: line.page };
        }
      }
    }
    return { key: spec.key, value: null, raw: null, confidence: 0, evidence: null, page: null };
  });
}

/* ---------- Checks against the pet's profile and the rules ---------- */

export type PetProfile = {
  name: string;
  species: string;
  microchipNumber: string | null;
  microchipDate: string | null;
  birthYear: number;
  birthMonth: number;
  birthDay: number | null;
};

export type FieldIssue = {
  key: FieldKey | "type";
  /** "block": must be fixed before confirming. "check": the owner must look and acknowledge. */
  level: "block" | "check";
  message: string;
};

export const CONFIDENT = 0.8;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Problems an owner must see before these details can update the plan. */
export function checkFields(
  type: DocType,
  fields: Pick<ExtractedField, "key" | "value" | "confidence">[],
  pet: PetProfile,
  today: ISODate,
  opts: { typeConfidence?: number; readable?: boolean } = {},
): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const get = (k: FieldKey) => fields.find((f) => f.key === k);
  const val = (k: FieldKey) => get(k)?.value ?? null;

  if (type === "OTHER") return issues;
  if (opts.readable === false) {
    issues.push({ key: "type", level: "check", message: "We couldn't read any text in this file, so the details need typing in from the document." });
  } else if (opts.typeConfidence !== undefined && opts.typeConfidence < 0.7) {
    issues.push({ key: "type", level: "check", message: `We're not sure this is a ${DOC_TYPE_LABEL[type].toLowerCase()}. Check the document type.` });
  }

  for (const spec of FIELD_SPECS[type]) {
    const f = get(spec.key);
    const v = f?.value ?? null;
    if (!v) {
      if (spec.required) issues.push({ key: spec.key, level: "block", message: `Enter the ${spec.label.toLowerCase()} from the document.` });
      continue;
    }
    if (spec.kind === "date") {
      if (!isISODate(v)) {
        issues.push({ key: spec.key, level: "block", message: "Enter a valid date." });
        continue;
      }
      if (spec.key !== "validUntil" && isAfter(v, today)) {
        issues.push({ key: spec.key, level: "block", message: "This date is in the future. Check it against the document." });
      }
    }
    if (spec.kind === "chip" && !/^\d{15}$/.test(v)) {
      issues.push({ key: spec.key, level: "check", message: "Most microchip numbers have 15 digits. Older chips may differ: check it against the document." });
    }
    if (f && f.confidence > 0 && f.confidence < CONFIDENT) {
      issues.push({
        key: spec.key,
        level: "check",
        message:
          spec.kind === "date"
            ? "This date could be read two ways (day/month). Check it against the document."
            : "We weren't sure about this one. Check it against the document.",
      });
    }
  }

  /* Against the pet's profile */
  const chip = val("microchipNumber");
  if (chip && pet.microchipNumber && norm(chip) !== norm(pet.microchipNumber)) {
    issues.push({
      key: "microchipNumber",
      level: "check",
      message: `Doesn't match ${pet.name}'s microchip number on file (ending ${pet.microchipNumber.slice(-4)}). Is this ${pet.name}'s document?`,
    });
  }
  const name = val("petName");
  if (name && !norm(name).includes(norm(pet.name)) && !norm(pet.name).includes(norm(name))) {
    issues.push({ key: "petName", level: "check", message: `The document names "${name}", but this upload is for ${pet.name}.` });
  }
  const species = val("species");
  if (species && !norm(species).includes(norm(pet.species)) && /dog|cat|ferret/i.test(species)) {
    issues.push({ key: "species", level: "check", message: `The document says ${species}, but ${pet.name} is a ${pet.species.toLowerCase()}.` });
  }
  const dob = val("dateOfBirth");
  if (dob && isISODate(dob)) {
    const [y, m, d] = dob.split("-").map(Number);
    if (y !== pet.birthYear || m !== pet.birthMonth || (pet.birthDay && d !== pet.birthDay)) {
      issues.push({ key: "dateOfBirth", level: "check", message: `Doesn't match ${pet.name}'s date of birth on file.` });
    }
  }

  /* Against the rules */
  const vaccinated = val("vaccinationDate");
  const validUntil = val("validUntil");
  if (vaccinated && validUntil && isISODate(vaccinated) && isISODate(validUntil) && !isAfter(validUntil, vaccinated)) {
    issues.push({ key: "validUntil", level: "block", message: "The valid-until date must be after the vaccination date." });
  } else if (validUntil && isISODate(validUntil) && isBefore(validUntil, today)) {
    issues.push({ key: "validUntil", level: "check", message: "This vaccination has expired. A new one starts the waiting period again." });
  }
  const implanted = type === "MICROCHIP" ? val("implantDate") : pet.microchipDate;
  if (type === "RABIES" && vaccinated && implanted && isISODate(vaccinated) && isISODate(implanted) && isBefore(vaccinated, implanted)) {
    issues.push({
      key: "vaccinationDate",
      level: "check",
      message: `This vaccination was given before the microchip (${implanted}), so it doesn't count for travel.`,
    });
  }

  /* One issue per field, most serious first */
  const seen = new Set<string>();
  return issues
    .sort((a, b) => (a.level === b.level ? 0 : a.level === "block" ? -1 : 1))
    .filter((i) => (seen.has(`${i.key}:${i.message}`) ? false : (seen.add(`${i.key}:${i.message}`), true)));
}

export type ReviewState = "READY" | "NEEDS_REVIEW" | "STORED";

export function reviewState(type: DocType, issues: FieldIssue[]): ReviewState {
  if (type === "OTHER") return "STORED";
  return issues.length ? "NEEDS_REVIEW" : "READY";
}
