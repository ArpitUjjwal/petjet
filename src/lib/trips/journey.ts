/*
 * The guided journey on Home: the few big steps of a trip, in order, each with one action.
 * Worked out from data the app already has; nothing is stored for it.
 */
import type { PetPlan } from "./plan";

export type JourneyStepId = "documents" | "certificate" | "flights" | "insurance" | "ready";
export type JourneyState = "done" | "current" | "upcoming";

export type JourneyStep = {
  id: JourneyStepId;
  title: string;
  /** What this step is, in a sentence */
  description: string;
  /** Shown once the step is done */
  doneLabel: string;
  state: JourneyState;
  href: string;
  cta: string;
};

export type JourneyInput = {
  tripId: string;
  petNames: string;
  plans: PetPlan[];
  /** Documents still to check, and the first one */
  toReview: number;
  firstToReviewId?: string | null;
  legsNeeded: number;
  legsBooked: number;
  insurer: string | null;
};

/** The vet-certificate step for the way out: the health certificate when the route needs one, else the first vet step. */
export function certificateTask(plans: PetPlan[]) {
  for (const { pet, plan } of plans) {
    if (!plan.supported) continue;
    const ahc = plan.tasks.find((t) => t.id === "ahc");
    if (ahc) return { petId: pet.id, task: ahc };
  }
  for (const { pet, plan } of plans) {
    if (!plan.supported) continue;
    const vet = plan.tasks.find((t) => t.blocking && t.service && t.leg === "OUTBOUND" && !t.abroad && t.status !== "DONE");
    if (vet) return { petId: pet.id, task: vet };
  }
  return null;
}

export function buildJourney(input: JourneyInput): JourneyStep[] {
  const { tripId, petNames: names } = input;
  const cert = certificateTask(input.plans);
  const certDone = !cert || input.plans.every(({ plan }) => !plan.supported || plan.tasks.filter((t) => t.id === cert.task.id).every((t) => t.status === "DONE"));

  const steps: Omit<JourneyStep, "state">[] = [
    {
      id: "documents",
      title: "Check documents",
      description:
        input.toReview > 0
          ? `We read ${input.toReview === 1 ? "a certificate" : `${input.toReview} documents`} for you. Check the details are right.`
          : "Upload a vet record and we'll read the details for you.",
      doneLabel: "Documents checked",
      href: input.firstToReviewId ? `/app/documents/${input.firstToReviewId}` : "/app/documents",
      cta: input.toReview > 0 ? "Check details" : "Open documents",
    },
    {
      id: "certificate",
      title: cert?.task.id === "ahc" || !cert ? "Health certificate" : cert.task.title,
      description: cert
        ? `An official vet issues it for ${names}. We'll book one and share the records.`
        : "No vet visit is needed before this trip.",
      doneLabel: cert?.task.id === "ahc" || !cert ? "Certificate issued" : "Vet visit done",
      href: cert ? `/app/vets?trip=${tripId}&pet=${cert.petId}&task=${cert.task.id}` : `/app/trips/${tripId}`,
      cta: "Book a vet",
    },
    {
      id: "flights",
      title: "Book flights",
      description: `We've picked flights that accept ${names}, there and back.`,
      doneLabel: input.legsNeeded > 1 ? "Flights booked both ways" : "Flight booked",
      href: `/app/flights?trip=${tripId}`,
      cta: "See flights",
    },
    {
      id: "insurance",
      title: `Insure ${names}`,
      description: "Compare four travel plans and choose the cover that fits.",
      doneLabel: input.insurer ? `Covered by ${input.insurer}` : "Insured",
      href: `/app/insurance?trip=${tripId}`,
      cta: "Compare cover",
    },
    {
      id: "ready",
      title: "Ready to fly",
      description: "Everything is in place for the journey out.",
      doneLabel: "Ready to fly",
      href: `/app/trips/${tripId}`,
      cta: "See your plan",
    },
  ];

  const done: Record<JourneyStepId, boolean> = {
    documents: input.toReview === 0,
    certificate: certDone,
    flights: input.legsNeeded > 0 && input.legsBooked >= input.legsNeeded,
    insurance: input.insurer !== null,
    ready: false,
  };
  done.ready = done.documents && done.certificate && done.flights && done.insurance;

  let currentSet = false;
  return steps.map((s) => {
    if (done[s.id]) return { ...s, state: "done" as const };
    if (!currentSet) {
      currentSet = true;
      return { ...s, state: "current" as const };
    }
    return { ...s, state: "upcoming" as const };
  });
}

export function journeyComplete(steps: JourneyStep[]) {
  return steps.every((s) => s.state === "done");
}
