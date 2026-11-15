import type { ISODate } from "./dates";

export const SPECIES = ["DOG", "CAT", "FERRET"] as const;
export type Species = (typeof SPECIES)[number];

export type ReviewStatus = "VERIFIED" | "NEEDS_REVIEW";
export type Leg = "OUTBOUND" | "RETURN";

/** A route is written "FROM-TO" with ISO country codes, e.g. "GB-FR". */
export type RouteKey = string;

export type RuleSource = { name: string; url: string };

/**
 * One verified requirement. Conditions the engine computes with live in `params`
 * as structured values, not prose, so a rules update changes behaviour without code changes.
 */
export type Rule = {
  id: string;
  version: number;
  routes: RouteKey[];
  species: Species[];
  title: string;
  summary: string;
  sources: RuleSource[];
  lastVerified: ISODate;
  reviewStatus: ReviewStatus;
  params: Record<string, unknown>;
};

/* ---------- Engine input ---------- */

export type MicrochipInput = {
  status: "YES" | "NO" | "UNKNOWN";
  implantedOn?: ISODate;
};

export type RabiesInput = {
  status: "VACCINATED" | "NONE" | "UNKNOWN";
  /** Date of the most recent dose (the last dose of the first course, or the latest booster) */
  lastDoseOn?: ISODate;
  /** PRIMARY: first course, so the waiting period applies. BOOSTER: given with no break in cover. */
  lastDoseKind?: "PRIMARY" | "BOOSTER";
  /** When the current vaccination stops being valid, from the vaccine record */
  validUntil?: ISODate;
};

export type PetInput = {
  name: string;
  /** Free text from the owner; anything other than the supported species is rejected */
  species: string;
  breed?: string;
  /** For dogs going to France: does the dog have a pedigree recognised by the French authorities? */
  hasPedigree?: boolean;
  dateOfBirth?: ISODate;
  microchip: MicrochipInput;
  rabies: RabiesInput;
};

export type TripInput = {
  origin: string;
  destination: string;
  /** Date the pet arrives at the destination. Most rules count back from arrival. */
  arrivalDate: ISODate;
  /** Date the pet arrives back in the origin country. Omit for one-way plans. */
  returnDate?: ISODate;
  petCount: number;
  purpose: "PERSONAL" | "COMMERCIAL";
  /** Who the pet travels with */
  accompaniment: "OWNER" | "AUTHORISED_PERSON" | "UNACCOMPANIED";
  /** IATA code of the arrival airport, when known */
  arrivalAirport?: string;
};

/** Evidence that tasks have been done, recorded by owners, vets or document checks. */
export type TaskRecords = {
  ahcIssuedOn?: ISODate;
  tapewormOutboundOn?: ISODate;
  irelandNoticeGiven?: boolean;
  cdcFormSubmittedOn?: ISODate;
  pedigreeCarried?: boolean;
  returnCertificateIssuedOn?: ISODate;
  tapewormReturnOn?: ISODate;
  approvedRouteBooked?: boolean;
  authorisedDeclarationSigned?: boolean;
};

/* ---------- Engine output ---------- */

export type VetService =
  | "MICROCHIP"
  | "RABIES_VACCINATION"
  | "RABIES_BOOSTER"
  | "ANIMAL_HEALTH_CERTIFICATE"
  | "TAPEWORM_TREATMENT"
  | "GB_PET_HEALTH_CERTIFICATE";

export type TaskStatus = "DONE" | "TODO" | "VERIFY" | "BLOCKED" | "INFO";

export type TaskCategory = "IDENTIFICATION" | "VACCINATION" | "TREATMENT" | "DOCUMENT" | "TRAVEL" | "CHECK";

export type PlanTask = {
  id: string;
  ruleIds: string[];
  leg: Leg;
  category: TaskCategory;
  title: string;
  detail: string;
  status: TaskStatus;
  /** Inclusive date window in which the task must happen */
  window?: { from?: ISODate; to?: ISODate };
  dependsOn: string[];
  /** Vet or lab service that completes this task, used for provider matching */
  service?: VetService;
  officialVet?: boolean;
  /** Done by a vet in the destination country rather than at home */
  abroad?: boolean;
  /** Advisory tasks never block readiness */
  blocking: boolean;
};

export type Blocker = {
  code: string;
  message: string;
  /** The rule that blocks the trip; absent for input problems such as a past date */
  ruleId?: string;
  taskId?: string;
  leg: Leg;
  /** Earliest date the affected journey could happen, when one exists */
  earliestDate?: ISODate;
};

export type UnsupportedReason = {
  code:
    | "ROUTE_NOT_SUPPORTED"
    | "SPECIES_NOT_SUPPORTED"
    | "TOO_MANY_PETS"
    | "COMMERCIAL_MOVEMENT";
  message: string;
};

export type PlanStatus = "READY" | "IN_PROGRESS" | "NEEDS_INFO" | "NOT_FEASIBLE";

export type SupportedPlan = {
  supported: true;
  route: RouteKey;
  returnRoute?: RouteKey;
  status: PlanStatus;
  tasks: PlanTask[];
  blockers: Blocker[];
  /** Set when the chosen arrival date can't work but a later one can */
  earliestFeasibleArrival?: ISODate;
  /** Set when only the return date is the problem */
  earliestFeasibleReturn?: ISODate;
  /** Every rule that applied to this plan, for sources and dates */
  rules: Rule[];
  warnings: string[];
};

export type UnsupportedPlan = { supported: false; reasons: UnsupportedReason[] };

export type Plan = SupportedPlan | UnsupportedPlan;
