/*
 * PetJet travel rules engine.
 *
 * Deterministic and pure: the same pet, trip, records and "today" always give the same plan.
 * It never guesses. Unknown facts become VERIFY tasks; impossible dates become blockers
 * with the earliest date that would work, where one exists.
 *
 * All windows are inclusive date ranges. Rules stated in hours (tapeworm: 24 to 120 hours
 * before arrival) are converted to whole days conservatively, and the hour rule is shown
 * to the user in the task detail.
 */
import { COUNTRY_NAMES, RULES, SUPPORTED_ROUTE_SPECIES } from "./catalog";
import {
  addDays,
  addMonths,
  formatDate,
  isAfter,
  isBefore,
  isISODate,
  isWithin,
  maxDate,
  type ISODate,
} from "./dates";
import type {
  Blocker,
  Leg,
  PetInput,
  Plan,
  PlanStatus,
  PlanTask,
  Rule,
  Species,
  TaskRecords,
  TripInput,
  UnsupportedReason,
} from "./types";

export class PlanInputError extends Error {
  constructor(
    message: string,
    readonly field: string,
  ) {
    super(message);
    this.name = "PlanInputError";
  }
}

export type EvaluateOptions = {
  /** Today's date; always pass it in so results are reproducible */
  today: ISODate;
  /** Rules to use; defaults to the built-in verified catalog */
  rules?: Rule[];
  records?: TaskRecords;
};

const SPECIES_LABEL: Record<Species, string> = { DOG: "dogs", CAT: "cats", FERRET: "ferrets" };

export function normaliseSpecies(value: string): string {
  return value.trim().toUpperCase();
}

function countryName(code: string) {
  return COUNTRY_NAMES[code] ?? code;
}

/* ---------- Input validation ---------- */

function checkDate(value: ISODate | undefined, field: string, required = false) {
  if (value === undefined || value === "") {
    if (required) throw new PlanInputError(`${field} is required.`, field);
    return;
  }
  if (!isISODate(value)) throw new PlanInputError(`${field} must be a valid date (YYYY-MM-DD).`, field);
}

function validate(pet: PetInput, trip: TripInput, opts: EvaluateOptions) {
  checkDate(opts.today, "today", true);
  checkDate(trip.arrivalDate, "arrivalDate", true);
  checkDate(trip.returnDate, "returnDate");
  checkDate(pet.dateOfBirth, "dateOfBirth");
  checkDate(pet.microchip.implantedOn, "microchip.implantedOn");
  checkDate(pet.rabies.lastDoseOn, "rabies.lastDoseOn");
  checkDate(pet.rabies.validUntil, "rabies.validUntil");
  const r = opts.records ?? {};
  for (const key of [
    "ahcIssuedOn",
    "tapewormOutboundOn",
    "cdcFormSubmittedOn",
    "returnCertificateIssuedOn",
    "tapewormReturnOn",
  ] as const) {
    checkDate(r[key], `records.${key}`);
  }

  if (trip.returnDate && !isAfter(trip.returnDate, trip.arrivalDate)) {
    throw new PlanInputError("The return date must be after the arrival date.", "returnDate");
  }
  if (pet.dateOfBirth && isAfter(pet.dateOfBirth, opts.today)) {
    throw new PlanInputError("The date of birth can't be in the future.", "dateOfBirth");
  }
  if (pet.rabies.lastDoseOn && isAfter(pet.rabies.lastDoseOn, opts.today)) {
    throw new PlanInputError("The vaccination date can't be in the future.", "rabies.lastDoseOn");
  }
  if (pet.microchip.implantedOn && isAfter(pet.microchip.implantedOn, opts.today)) {
    throw new PlanInputError("The microchip date can't be in the future.", "microchip.implantedOn");
  }
  if (!Number.isInteger(trip.petCount) || trip.petCount < 1) {
    throw new PlanInputError("The number of pets must be a whole number of at least 1.", "petCount");
  }
}

/* ---------- Plan builder ---------- */

class Builder {
  private readonly byId: Map<string, Rule>;
  private readonly all: Rule[];
  readonly used = new Set<string>();
  readonly tasks: PlanTask[] = [];
  readonly blockers: Blocker[] = [];
  readonly warnings: string[] = [];

  constructor(rules: Rule[]) {
    this.all = rules;
    this.byId = new Map(rules.map((r) => [r.id, r]));
  }

  /** Rules that applied to this plan, in rules-set order */
  usedRules(): Rule[] {
    return this.all.filter((r) => this.used.has(r.id));
  }

  rule(id: string): Rule {
    const rule = this.byId.get(id);
    if (!rule) throw new Error(`Rule ${id} is missing from the rules set.`);
    this.used.add(id);
    return rule;
  }

  num(id: string, key: string): number {
    const v = this.rule(id).params[key];
    if (typeof v !== "number") throw new Error(`Rule ${id} has no numeric param "${key}".`);
    return v;
  }

  list(id: string, key: string): string[] {
    const v = this.rule(id).params[key];
    if (!Array.isArray(v)) throw new Error(`Rule ${id} has no list param "${key}".`);
    return v.map(String);
  }

  add(task: Omit<PlanTask, "dependsOn" | "blocking"> & { dependsOn?: string[]; blocking?: boolean }) {
    for (const id of task.ruleIds) this.rule(id);
    const full: PlanTask = { dependsOn: [], blocking: task.status !== "INFO", ...task };
    this.tasks.push(full);
    return full;
  }

  block(blocker: Blocker) {
    if (blocker.ruleId) this.rule(blocker.ruleId);
    this.blockers.push(blocker);
  }

  has(id: string) {
    return this.tasks.some((t) => t.id === id);
  }
}

function hoursToDayWindow(arrival: ISODate, minHours: number, maxHours: number) {
  /* "No less than 24h and no more than 120h before arrival", in whole days:
     the latest safe day is the day before arrival, the earliest is 5 days before. */
  return {
    from: addDays(arrival, -Math.floor(maxHours / 24)),
    to: addDays(arrival, -Math.ceil(minHours / 24)),
  };
}

function matchesBreed(breed: string | undefined, patterns: string[], excluded: string[]) {
  if (!breed) return null;
  const b = breed.toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
  if (excluded.some((p) => b.includes(p))) return null;
  return patterns.find((p) => b.includes(p)) ?? null;
}

/** The restricted French breed type a dog's breed matches, or null. Used to ask about pedigrees. */
export function franceRestrictedBreed(breed: string | undefined, rules: Rule[] = RULES): string | null {
  const rule = rules.find((r) => r.id === "FR-DOG-CATEGORY");
  if (!rule) return null;
  const list = (k: string) => (Array.isArray(rule.params[k]) ? (rule.params[k] as unknown[]).map(String) : []);
  return matchesBreed(breed, list("breedPatterns"), list("excludedPatterns"));
}

export function evaluateTrip(pet: PetInput, trip: TripInput, opts: EvaluateOptions): Plan {
  validate(pet, trip, opts);

  const today = opts.today;
  const records = opts.records ?? {};
  const origin = trip.origin.trim().toUpperCase();
  const dest = trip.destination.trim().toUpperCase();
  const route = `${origin}-${dest}`;
  const species = normaliseSpecies(pet.species);

  /* ---- Is this something PetJet can plan at all? ---- */
  const reasons: UnsupportedReason[] = [];
  const allowed = SUPPORTED_ROUTE_SPECIES[route];
  if (!allowed) {
    reasons.push({
      code: "ROUTE_NOT_SUPPORTED",
      message: `PetJet doesn't plan trips from ${countryName(origin)} to ${countryName(dest)} yet. We only plan routes whose rules we have verified.`,
    });
  } else if (!allowed.includes(species)) {
    const list = allowed.map((s) => SPECIES_LABEL[s as Species]).join(", ").replace(/, ([^,]*)$/, " and $1");
    reasons.push({
      code: "SPECIES_NOT_SUPPORTED",
      message: `For ${countryName(dest)}, PetJet plans trips for ${list} only. Other animals have different rules that we haven't verified.`,
    });
  }
  const b = new Builder(opts.rules ?? RULES);
  const maxPets = b.num("GB-EU-PET-LIMIT", "maxPets");
  if (trip.petCount > maxPets) {
    reasons.push({
      code: "TOO_MANY_PETS",
      message: `Travelling with more than ${maxPets} pets counts as a commercial movement, which has different rules. PetJet plans personal trips of up to ${maxPets} pets.`,
    });
  }
  if (trip.purpose === "COMMERCIAL" || trip.accompaniment === "UNACCOMPANIED") {
    reasons.push({
      code: "COMMERCIAL_MOVEMENT",
      message:
        "Selling or rehoming a pet, or sending it without you or someone you authorise, is a commercial movement with different rules. PetJet plans personal trips only.",
    });
  }
  if (reasons.length) return { supported: false, reasons };

  const sp = species as Species;
  const isDog = sp === "DOG";
  const A = trip.arrivalDate;
  const R = trip.returnDate;
  const isEU = dest === "FR" || dest === "IE";
  const isUS = dest === "US";
  const returnRoute = R ? `${dest}-${origin}` : undefined;
  const destName = countryName(dest);

  if (isBefore(A, today)) {
    b.block({
      code: "DATE_IN_PAST",
      message: `The arrival date, ${formatDate(A)}, has already passed.`,
      leg: "OUTBOUND",
      earliestDate: today,
    });
  }
  if (!R) b.warnings.push("No return date yet. Add one to plan the journey home to Great Britain.");

  if (isEU) {
    b.rule("GB-EU-PET-LIMIT");
    b.rule("GB-EU-ACCOMPANIED");
    if (trip.accompaniment === "AUTHORISED_PERSON") {
      b.add({
        id: "authorised-person",
        ruleIds: ["GB-EU-ACCOMPANIED"],
        leg: "OUTBOUND",
        category: "DOCUMENT",
        title: "Sign a declaration for the person travelling with your pet",
        detail: `They must travel within ${b.num("GB-EU-ACCOMPANIED", "withinDays")} days of your own journey and carry your signed declaration and proof of your travel dates.`,
        status: records.authorisedDeclarationSigned ? "DONE" : "TODO",
        window: records.authorisedDeclarationSigned ? undefined : { to: A },
      });
    }
  }

  /* ---- Which arrivals need a valid rabies vaccination? ---- */
  const rabiesNeededOutbound = isEU;
  const rabiesNeeded = rabiesNeededOutbound || !!R;
  const rabiesLeg: Leg = rabiesNeededOutbound ? "OUTBOUND" : "RETURN";
  const rabiesDeadline = rabiesNeededOutbound ? A : R;
  const rabiesRuleIds = [
    ...(rabiesNeededOutbound ? ["GB-EU-RABIES"] : []),
    ...(R ? ["GB-ENTRY-MICROCHIP-RABIES"] : []),
  ];
  const rabiesRuleId = rabiesRuleIds[0];

  /* ---- Microchip ---- */
  const microchipOutbound = isEU || (isUS && isDog);
  const microchipNeeded = microchipOutbound || !!R;
  if (microchipNeeded) {
    const ruleIds = [
      ...(isEU ? ["GB-EU-MICROCHIP"] : []),
      ...(isUS && isDog ? ["US-DOG-MICROCHIP"] : []),
      ...(R ? ["GB-ENTRY-MICROCHIP-RABIES"] : []),
    ];
    const deadline = (microchipOutbound ? A : R) as ISODate;
    const mc = pet.microchip;
    b.add({
      id: "microchip",
      ruleIds,
      leg: microchipOutbound ? "OUTBOUND" : "RETURN",
      category: "IDENTIFICATION",
      title: "Microchip",
      detail:
        mc.status === "YES"
          ? `${pet.name} is microchipped${mc.implantedOn ? ` (implanted ${formatDate(mc.implantedOn)})` : ""}. Keep the microchip number with your travel documents.`
          : mc.status === "NO"
            ? `${pet.name} needs an ISO-standard microchip${rabiesNeeded ? " before, or at the same time as, the rabies vaccination" : ""}.`
            : `Check that ${pet.name} has a working microchip. Your vet can scan it, or it may be on an existing record.`,
      status: mc.status === "YES" ? "DONE" : mc.status === "NO" ? "TODO" : "VERIFY",
      window: mc.status === "YES" ? undefined : { from: today, to: deadline },
      service: "MICROCHIP",
    });
  }

  /* ---- Rabies vaccination ---- */
  let rabiesReadyOn: ISODate | undefined;
  if (rabiesNeeded && rabiesRuleId && rabiesDeadline) {
    const wait = b.num(rabiesRuleId, "waitFullDays");
    const minAgeDays = b.num(rabiesRuleId, "minAgeDays");
    const readyAfter = wait + 1; // 21 full days, day 1 being the day after vaccination
    const rab = pet.rabies;
    let status = rab.status;

    /* Vaccinations that don't count must be started again */
    if (status === "VACCINATED") {
      const primary = rab.lastDoseKind !== "BOOSTER";
      if (pet.microchip.status === "NO") {
        b.warnings.push(
          "A rabies vaccination given before microchipping doesn't count. After the microchip, the vaccination must be given again.",
        );
        status = "NONE";
      } else if (
        primary &&
        pet.microchip.implantedOn &&
        rab.lastDoseOn &&
        isAfter(pet.microchip.implantedOn, rab.lastDoseOn)
      ) {
        b.warnings.push(
          `The microchip (${formatDate(pet.microchip.implantedOn)}) was implanted after the rabies vaccination (${formatDate(rab.lastDoseOn)}), so the vaccination must be given again.`,
        );
        status = "NONE";
      } else if (primary && pet.dateOfBirth && rab.lastDoseOn && isBefore(rab.lastDoseOn, addDays(pet.dateOfBirth, minAgeDays))) {
        b.warnings.push(
          `The rabies vaccination was given before ${pet.name} was 12 weeks old, so it must be given again.`,
        );
        status = "NONE";
      } else if (rab.validUntil && isBefore(rab.validUntil, today)) {
        b.warnings.push(
          `The rabies vaccination expired on ${formatDate(rab.validUntil)}. With a break in cover, vaccination starts again, including the wait.`,
        );
        status = "NONE";
      }
    }

    const legNote =
      rabiesLeg === "RETURN"
        ? " The USA doesn't require it for UK dogs and cats, but Great Britain does when you come home. It's easiest to do before you leave."
        : "";

    if (status === "NONE") {
      const earliest = maxDate(today, pet.dateOfBirth ? addDays(pet.dateOfBirth, minAgeDays) : undefined)!;
      const latest = addDays(rabiesDeadline, -readyAfter);
      const impossible = isAfter(earliest, latest);
      const t = b.add({
        id: "rabies",
        ruleIds: rabiesRuleIds,
        leg: rabiesLeg,
        category: "VACCINATION",
        title: "Rabies vaccination",
        detail: `Vaccinate by ${formatDate(latest)} so the ${wait}-day wait ends before ${rabiesLeg === "OUTBOUND" ? "you arrive" : "you return to Great Britain"}. Your pet must be at least 12 weeks old.${legNote}`,
        status: impossible ? "BLOCKED" : "TODO",
        window: { from: earliest, to: impossible ? undefined : latest },
        dependsOn: microchipNeeded ? ["microchip"] : [],
        service: "RABIES_VACCINATION",
      });
      if (impossible) {
        const earliestOk = addDays(earliest, readyAfter);
        b.block({
          code: "RABIES_WAIT",
          message: `A first rabies vaccination needs ${wait} full days before travel. The earliest ${pet.name} could ${rabiesLeg === "OUTBOUND" ? `arrive in ${destName}` : "return to Great Britain"} is ${formatDate(earliestOk)}.`,
          ruleId: rabiesRuleId,
          taskId: t.id,
          leg: rabiesLeg,
          earliestDate: earliestOk,
        });
      }
    } else if (status === "UNKNOWN" || (status === "VACCINATED" && !rab.lastDoseOn)) {
      b.add({
        id: "rabies",
        ruleIds: rabiesRuleIds,
        leg: rabiesLeg,
        category: "VACCINATION",
        title: status === "UNKNOWN" ? "Check rabies vaccination" : "Add the rabies vaccination date",
        detail: `We need the date of the last rabies dose to work out the ${wait}-day wait. Upload the vaccination record or ask your vet. Until then we can't treat this step as done.`,
        status: "VERIFY",
        dependsOn: microchipNeeded ? ["microchip"] : [],
      });
    } else if (status === "VACCINATED" && rab.lastDoseOn) {
      const isBooster = rab.lastDoseKind === "BOOSTER";
      rabiesReadyOn = isBooster ? rab.lastDoseOn : addDays(rab.lastDoseOn, readyAfter);
      const tooLate = isAfter(rabiesReadyOn, rabiesDeadline);
      const t = b.add({
        id: "rabies",
        ruleIds: rabiesRuleIds,
        leg: rabiesLeg,
        category: "VACCINATION",
        title: "Rabies vaccination",
        detail: isBooster
          ? `Booster given ${formatDate(rab.lastDoseOn)} with no break in cover, so no waiting period applies.`
          : `Vaccinated ${formatDate(rab.lastDoseOn)}. The ${wait}-day wait ${tooLate ? "ends" : "ended"} on ${formatDate(addDays(rabiesReadyOn, -1))}.${rab.lastDoseKind ? "" : " We've assumed this was a first vaccination; if it was a booster with no break in cover, tell us and the wait won't apply."}`,
        status: tooLate ? "BLOCKED" : "DONE",
        dependsOn: microchipNeeded ? ["microchip"] : [],
      });
      if (tooLate) {
        b.block({
          code: "RABIES_WAIT",
          message: `The ${wait}-day wait after the rabies vaccination isn't over until ${formatDate(addDays(rabiesReadyOn, -1))}. The earliest ${pet.name} can ${rabiesLeg === "OUTBOUND" ? `arrive in ${destName}` : "return to Great Britain"} is ${formatDate(rabiesReadyOn)}.`,
          ruleId: rabiesRuleId,
          taskId: t.id,
          leg: rabiesLeg,
          earliestDate: rabiesReadyOn,
        });
      }
    }

    /* Vaccination must still be valid on the last arrival that needs it */
    const lastNeeded = (R ?? A) as ISODate;
    if (status === "VACCINATED" && rab.lastDoseOn) {
      if (rab.validUntil && isBefore(rab.validUntil, lastNeeded)) {
        b.add({
          id: "rabies-booster",
          ruleIds: rabiesRuleIds,
          leg: R ? "RETURN" : "OUTBOUND",
          category: "VACCINATION",
          title: "Rabies booster before the vaccine expires",
          detail: `The vaccination is valid until ${formatDate(rab.validUntil)}, before ${R ? "you return" : "you arrive"} on ${formatDate(lastNeeded)}. A booster given on or before ${formatDate(rab.validUntil)} keeps cover unbroken, so there's no new wait.`,
          status: "TODO",
          window: { from: today, to: rab.validUntil },
          dependsOn: ["rabies"],
          service: "RABIES_BOOSTER",
        });
      } else if (!rab.validUntil) {
        b.add({
          id: "rabies-validity",
          ruleIds: rabiesRuleIds,
          leg: rabiesLeg,
          category: "CHECK",
          title: "Check the vaccination stays valid",
          detail: `Make sure the vaccine's valid-until date on the record is after ${formatDate(lastNeeded)}. If it isn't, get a booster before it expires.`,
          status: "INFO",
        });
      }
    }
  }

  /* ---- Minimum ages at arrival ---- */
  function ageCheck(id: string, ruleId: string, minDate: ISODate | undefined, label: string) {
    if (!pet.dateOfBirth || !minDate) {
      b.add({
        id,
        ruleIds: [ruleId],
        leg: "OUTBOUND",
        category: "CHECK",
        title: "Add your pet's date of birth",
        detail: `${label} An approximate date is fine if you don't know it exactly.`,
        status: "VERIFY",
      });
      return;
    }
    const tooYoung = isBefore(A, minDate);
    const t = b.add({
      id,
      ruleIds: [ruleId],
      leg: "OUTBOUND",
      category: "CHECK",
      title: tooYoung ? `Too young to enter ${destName}` : `Old enough to enter ${destName}`,
      detail: `${label} ${pet.name} reaches the minimum age on ${formatDate(minDate)}.`,
      status: tooYoung ? "BLOCKED" : "DONE",
    });
    if (tooYoung) {
      b.block({
        code: "TOO_YOUNG",
        message: `${pet.name} will be too young on ${formatDate(A)}. The earliest arrival in ${destName} is ${formatDate(minDate)}.`,
        ruleId,
        taskId: t.id,
        leg: "OUTBOUND",
        earliestDate: minDate,
      });
    }
  }

  if (dest === "FR") {
    const days = b.num("FR-MIN-AGE", "minAgeDays");
    ageCheck(
      "age-france",
      "FR-MIN-AGE",
      pet.dateOfBirth ? addDays(pet.dateOfBirth, days) : undefined,
      "Pets must be at least 16 weeks old to enter France.",
    );
  }
  if (isUS && isDog) {
    const months = b.num("US-DOG-AGE", "minAgeMonths");
    ageCheck(
      "age-usa",
      "US-DOG-AGE",
      pet.dateOfBirth ? addMonths(pet.dateOfBirth, months) : undefined,
      "Dogs must be at least 6 months old to enter the United States.",
    );
  }

  /* ---- France: restricted dog breeds ---- */
  if (dest === "FR" && isDog) {
    const match = matchesBreed(
      pet.breed,
      b.list("FR-DOG-CATEGORY", "breedPatterns"),
      b.list("FR-DOG-CATEGORY", "excludedPatterns"),
    );
    if (match) {
      const noPedigreePossible = b.list("FR-DOG-CATEGORY", "noPedigreePossible").includes(match);
      if (noPedigreePossible || pet.hasPedigree === false) {
        const t = b.add({
          id: "france-breed",
          ruleIds: ["FR-DOG-CATEGORY"],
          leg: "OUTBOUND",
          category: "CHECK",
          title: "This type of dog can't enter France",
          detail:
            "France bans Category 1 dogs: Staffordshire terrier, American Staffordshire terrier, Mastiff (Boerboel) and Tosa types without a recognised pedigree.",
          status: "BLOCKED",
        });
        b.block({
          code: "BREED_BANNED",
          message: `France does not allow ${pet.breed} type dogs without a recognised pedigree. Changing the date won't fix this.`,
          ruleId: "FR-DOG-CATEGORY",
          taskId: t.id,
          leg: "OUTBOUND",
        });
      } else if (pet.hasPedigree === undefined) {
        b.add({
          id: "france-breed",
          ruleIds: ["FR-DOG-CATEGORY"],
          leg: "OUTBOUND",
          category: "CHECK",
          title: "Confirm your dog's pedigree",
          detail: `${pet.breed} type dogs can only enter France with a pedigree recognised by the French authorities. Tell us whether ${pet.name} has one.`,
          status: "VERIFY",
        });
      } else {
        b.add({
          id: "france-breed",
          ruleIds: ["FR-DOG-CATEGORY"],
          leg: "OUTBOUND",
          category: "DOCUMENT",
          title: "Carry your dog's pedigree certificate",
          detail:
            "As a Category 2 dog in France, carry the pedigree or birth certificate. Keep your dog muzzled and on a lead in public places and on public transport.",
          status: records.pedigreeCarried ? "DONE" : "TODO",
          window: { to: A },
        });
      }
    }
  }

  /* ---- EU: animal health certificate ---- */
  let ahcCoversReturn = false;
  if (isEU) {
    const entryDays = b.num("GB-EU-AHC", "entryValidityDays");
    const reentryMonths = b.num("GB-EU-AHC", "reentryValidityMonths");
    const legalFrom = addDays(A, -(entryDays - 1)); // the issue date is day 1
    let from = maxDate(legalFrom, rabiesReadyOn, today)!;
    const to = A;
    let returnNote = "";
    if (R && !isAfter(R, addMonths(A, reentryMonths))) {
      ahcCoversReturn = true;
      const coverFrom = addMonths(R, -reentryMonths);
      if (isAfter(coverFrom, from)) {
        from = coverFrom;
        returnNote = ` To use it for the journey home on ${formatDate(R)}, get it on or after ${formatDate(coverFrom)}.`;
      } else {
        returnNote = ` It also covers your return to Great Britain on ${formatDate(R)}.`;
      }
    }
    const issued = records.ahcIssuedOn;
    const issuedValid =
      !!issued &&
      isWithin(issued, legalFrom, to) &&
      (!rabiesReadyOn || !isBefore(issued, rabiesReadyOn));
    if (issued && !issuedValid) {
      b.warnings.push(
        `The animal health certificate issued on ${formatDate(issued)} isn't valid for arriving on ${formatDate(A)}. A new one is needed.`,
      );
    }
    if (issuedValid && R && ahcCoversReturn && isAfter(R, addMonths(issued!, reentryMonths))) {
      ahcCoversReturn = false;
    }
    b.add({
      id: "ahc",
      ruleIds: ["GB-EU-AHC"],
      leg: "OUTBOUND",
      category: "DOCUMENT",
      title: "Animal health certificate",
      detail: issuedValid
        ? `Issued ${formatDate(issued!)}. Valid for arrival in ${destName} until ${formatDate(addDays(issued!, entryDays - 1))}.`
        : `An official vet issues it between ${formatDate(from)} and ${formatDate(to)}: it's valid for entry for ${entryDays} days, counting the issue date as day 1.${returnNote} Bring proof of the microchip date and vaccination history, and sign the declaration that you won't sell or rehome your pet.`,
      status: issuedValid ? "DONE" : "TODO",
      window: issuedValid ? undefined : { from, to },
      dependsOn: [...(microchipNeeded ? ["microchip"] : []), ...(rabiesNeeded ? ["rabies"] : [])],
      service: "ANIMAL_HEALTH_CERTIFICATE",
      officialVet: true,
    });
  }

  /* ---- Ireland ---- */
  if (dest === "IE") {
    if (isDog) {
      const w = hoursToDayWindow(A, b.num("IE-TAPEWORM", "minHours"), b.num("IE-TAPEWORM", "maxHours"));
      const done = !!records.tapewormOutboundOn && isWithin(records.tapewormOutboundOn, w.from, w.to);
      const passed = !done && isBefore(w.to, today);
      const t = b.add({
        id: "tapeworm-outbound",
        ruleIds: ["IE-TAPEWORM"],
        leg: "OUTBOUND",
        category: "TREATMENT",
        title: "Tapeworm treatment for Ireland",
        detail: done
          ? `Treated ${formatDate(records.tapewormOutboundOn!)}.`
          : `A vet gives a praziquantel treatment between ${formatDate(w.from)} and ${formatDate(w.to)}: at least 24 hours and no more than 120 hours before you land. They record it on the animal health certificate, so it's often done at the same appointment.`,
        status: done ? "DONE" : passed ? "BLOCKED" : "TODO",
        window: done ? undefined : { from: maxDate(w.from, today), to: w.to },
        dependsOn: ["ahc"],
        service: "TAPEWORM_TREATMENT",
      });
      if (passed) {
        b.block({
          code: "TAPEWORM_WINDOW_PASSED",
          message: `The tapeworm treatment must be given at least 24 hours before arrival, so arrival on ${formatDate(A)} is too soon.`,
          ruleId: "IE-TAPEWORM",
          taskId: t.id,
          leg: "OUTBOUND",
          earliestDate: addDays(today, 1),
        });
      }
    }

    const airports = b.list("IE-ENTRY-POINT", "airports");
    const airport = trip.arrivalAirport?.trim().toUpperCase();
    const badAirport = !!airport && !airports.includes(airport);
    const t = b.add({
      id: "ireland-entry",
      ruleIds: ["IE-ENTRY-POINT"],
      leg: "OUTBOUND",
      category: "TRAVEL",
      title: "Fly into Dublin, Shannon or Cork",
      detail: badAirport
        ? `${airport} isn't an approved point of entry for pets from Great Britain. Choose a flight into Dublin (DUB), Shannon (SNN) or Cork (ORK).`
        : airport
          ? `Arriving at ${airport}, an approved point of entry.`
          : "Pets from Great Britain can only fly into Dublin (DUB), Shannon (SNN) or Cork (ORK).",
      status: badAirport ? "BLOCKED" : airport ? "DONE" : "TODO",
      window: airport && !badAirport ? undefined : { to: A },
    });
    if (badAirport) {
      b.block({
        code: "ENTRY_POINT",
        message: `Pets from Great Britain can't enter Ireland through ${airport}.`,
        ruleId: "IE-ENTRY-POINT",
        taskId: t.id,
        leg: "OUTBOUND",
      });
    }

    b.add({
      id: "ireland-notice",
      ruleIds: ["IE-ADVANCE-NOTICE"],
      leg: "OUTBOUND",
      category: "DOCUMENT",
      title: "Tell the Irish point of entry you're coming",
      detail: "Give the point of entry advance notice of your pet's arrival before you travel.",
      status: records.irelandNoticeGiven ? "DONE" : "TODO",
      window: records.irelandNoticeGiven ? undefined : { from: today, to: addDays(A, -1) },
    });
  }

  /* ---- United States ---- */
  if (isUS) {
    if (isDog) {
      const months = b.num("US-DOG-IMPORT-FORM", "maxMonthsBefore");
      const from = addMonths(A, -months);
      const submitted = records.cdcFormSubmittedOn;
      const done = !!submitted && isWithin(submitted, from, A);
      b.add({
        id: "cdc-form",
        ruleIds: ["US-DOG-IMPORT-FORM"],
        leg: "OUTBOUND",
        category: "DOCUMENT",
        title: "CDC Dog Import Form",
        detail: done
          ? `Submitted ${formatDate(submitted!)}. Carry the receipt; it's valid for 6 months.`
          : `Complete the free online form and keep the receipt. You can do it from ${formatDate(from)}; a few days before you fly is recommended.`,
        status: done ? "DONE" : "TODO",
        window: done ? undefined : { from: maxDate(from, today), to: A },
      });
      b.add({
        id: "us-healthy",
        ruleIds: ["US-DOG-HEALTHY"],
        leg: "OUTBOUND",
        category: "CHECK",
        title: "Healthy on arrival",
        detail: "Dogs must appear healthy when they arrive. A dog that looks ill may need a vet exam at your cost.",
        status: "INFO",
      });
    } else {
      b.add({
        id: "us-cat",
        ruleIds: ["US-CAT"],
        leg: "OUTBOUND",
        category: "CHECK",
        title: "Check your US state and airline rules for cats",
        detail:
          "CDC doesn't require paperwork for cats, but cats are inspected on arrival, and many US states require a rabies vaccination. Check the rules for the state you're going to and your airline.",
        status: "INFO",
      });
    }
    b.add({
      id: "export-certificate-check",
      ruleIds: ["GB-EXPORT-NON-EU"],
      leg: "OUTBOUND",
      category: "CHECK",
      title: "Ask an official vet about an export health certificate",
      detail:
        "GOV.UK says pets leaving for non-EU countries need an export health certificate, but US entry rules for UK pets don't ask for one. We haven't been able to confirm which applies, so check with an official vet before you book.",
      status: "INFO",
      officialVet: true,
    });
  }

  /* ---- Return to Great Britain ---- */
  if (R) {
    const from = dest;
    const reentryMonths = isEU ? b.num("GB-ENTRY-DOCUMENT-EU", "ahcReentryMonths") : 0;

    if (isEU && ahcCoversReturn) {
      b.add({
        id: "return-document",
        ruleIds: ["GB-ENTRY-DOCUMENT-EU"],
        leg: "RETURN",
        category: "DOCUMENT",
        title: "Keep the animal health certificate for the journey home",
        detail: `It's accepted for re-entry to Great Britain for ${reentryMonths} months from the date it was issued.`,
        status: records.ahcIssuedOn && b.tasks.find((t) => t.id === "ahc")?.status === "DONE" ? "DONE" : "TODO",
        window: { to: R },
        dependsOn: ["ahc"],
      });
    } else {
      const days = b.num("GB-ENTRY-CERTIFICATE", "entryValidityDays");
      const w = { from: addDays(R, -(days - 1)), to: R };
      const issued = records.returnCertificateIssuedOn;
      const done = !!issued && isWithin(issued, w.from, w.to);
      b.add({
        id: "return-certificate",
        ruleIds: isEU ? ["GB-ENTRY-DOCUMENT-EU", "GB-ENTRY-CERTIFICATE"] : ["GB-ENTRY-CERTIFICATE"],
        leg: "RETURN",
        category: "DOCUMENT",
        title: "Great Britain pet health certificate",
        detail: done
          ? `Issued ${formatDate(issued!)}.`
          : `${isEU ? `Your stay is longer than the ${reentryMonths} months an animal health certificate covers, so you'll need` : "You'll need"} a Great Britain pet health certificate signed by an official vet in ${destName}, issued between ${formatDate(w.from)} and ${formatDate(w.to)}.`,
        status: done ? "DONE" : "TODO",
        window: done ? undefined : w,
        dependsOn: ["microchip", "rabies"].filter((id) => b.has(id)),
        service: "GB_PET_HEALTH_CERTIFICATE",
        officialVet: true,
        abroad: true,
      });
    }

    const exempt = b.list("GB-ENTRY-TAPEWORM", "exemptFrom").includes(from);
    if (isDog && !exempt) {
      const w = hoursToDayWindow(R, b.num("GB-ENTRY-TAPEWORM", "minHours"), b.num("GB-ENTRY-TAPEWORM", "maxHours"));
      const done = !!records.tapewormReturnOn && isWithin(records.tapewormReturnOn, w.from, w.to);
      b.add({
        id: "tapeworm-return",
        ruleIds: ["GB-ENTRY-TAPEWORM"],
        leg: "RETURN",
        category: "TREATMENT",
        title: "Tapeworm treatment before coming home",
        detail: done
          ? `Treated ${formatDate(records.tapewormReturnOn!)}.`
          : `A vet in ${destName} treats your dog between ${formatDate(w.from)} and ${formatDate(w.to)}: at least 24 hours and no more than 5 days before you enter Great Britain, recorded on your pet's document.`,
        status: done ? "DONE" : "TODO",
        window: done ? undefined : w,
        service: "TAPEWORM_TREATMENT",
        abroad: true,
      });
      const retreat = b.num("GB-ENTRY-TAPEWORM", "retreatWithinDays");
      b.add({
        id: "tapeworm-after-return",
        ruleIds: ["GB-ENTRY-TAPEWORM"],
        leg: "RETURN",
        category: "TREATMENT",
        title: "Treat for tapeworm again after you're home",
        detail: `GOV.UK advises treating your dog again within ${retreat} days of returning.`,
        status: "INFO",
        window: { from: R, to: addDays(R, retreat) },
        service: "TAPEWORM_TREATMENT",
      });
    } else if (isDog) {
      b.rule("GB-ENTRY-TAPEWORM");
      b.warnings.push(
        "No tapeworm treatment is needed to return to Great Britain directly from Ireland.",
      );
    }

    const routeExempt = b.list("GB-ENTRY-APPROVED-ROUTE", "exemptFrom").includes(from);
    if (!routeExempt) {
      b.add({
        id: "return-approved-route",
        ruleIds: ["GB-ENTRY-APPROVED-ROUTE"],
        leg: "RETURN",
        category: "TRAVEL",
        title: "Book an approved route home, with your pet as cargo",
        detail:
          "Pets flying into Great Britain must use an approved airline and route and travel as cargo in the hold. Assistance dogs and private charters are the exceptions.",
        status: records.approvedRouteBooked ? "DONE" : "TODO",
        window: records.approvedRouteBooked ? undefined : { to: R },
      });
    } else {
      b.rule("GB-ENTRY-APPROVED-ROUTE");
    }
  }

  return finish(b, route, returnRoute, A, R);
}

/* ---------- Ordering and overall status ---------- */

function sortKey(t: PlanTask, A: ISODate, R?: ISODate) {
  return t.window?.to ?? t.window?.from ?? (t.leg === "OUTBOUND" ? A : (R ?? A));
}

function finish(b: Builder, route: string, returnRoute: string | undefined, A: ISODate, R?: ISODate): Plan {
  /* Outbound before return; within a leg, finished steps first, then by deadline, advice last. */
  const legOrder = { OUTBOUND: 0, RETURN: 1 } as const;
  const rank = (t: PlanTask) => (t.status === "DONE" ? 0 : t.status === "INFO" ? 2 : 1);
  const tasks = b.tasks
    .map((t, i) => ({ t, i }))
    .sort(
      (x, y) =>
        legOrder[x.t.leg] - legOrder[y.t.leg] ||
        rank(x.t) - rank(y.t) ||
        sortKey(x.t, A, R).localeCompare(sortKey(y.t, A, R)) ||
        x.i - y.i,
    )
    .map(({ t }) => t);

  const blocking = tasks.filter((t) => t.blocking);
  let status: PlanStatus;
  if (b.blockers.length) status = "NOT_FEASIBLE";
  else if (blocking.some((t) => t.status === "VERIFY")) status = "NEEDS_INFO";
  else if (blocking.every((t) => t.status === "DONE")) status = "READY";
  else status = "IN_PROGRESS";

  const out = b.blockers.filter((x) => x.leg === "OUTBOUND");
  const back = b.blockers.filter((x) => x.leg === "RETURN");
  const earliest = (list: Blocker[]) =>
    list.length && list.every((x) => x.earliestDate) ? maxDate(...list.map((x) => x.earliestDate)) : undefined;

  const earliestFeasibleArrival = earliest(out);
  if (earliestFeasibleArrival && R && !isAfter(R, earliestFeasibleArrival)) {
    b.warnings.push("If you move the arrival date, move the return date too.");
  }

  return {
    supported: true,
    route,
    returnRoute,
    status,
    tasks,
    blockers: b.blockers,
    earliestFeasibleArrival,
    earliestFeasibleReturn: earliest(back),
    rules: b.usedRules(),
    warnings: b.warnings,
  };
}
