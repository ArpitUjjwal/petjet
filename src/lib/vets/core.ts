import { addDays, diffDays, isAfter, isBefore, type ISODate } from "@/lib/rules/dates";
import type { VetService } from "@/lib/rules/types";

/* Pure helpers for the vet network: which practices fit a step, and simulated appointment slots. */

export const SERVICE_LABEL: Record<VetService, string> = {
  MICROCHIP: "Microchipping",
  RABIES_VACCINATION: "Rabies vaccination",
  RABIES_BOOSTER: "Rabies booster",
  ANIMAL_HEALTH_CERTIFICATE: "Animal health certificate",
  TAPEWORM_TREATMENT: "Tapeworm treatment",
  GB_PET_HEALTH_CERTIFICATE: "GB pet health certificate",
};

export const VET_SERVICES = Object.keys(SERVICE_LABEL) as VetService[];

export function isVetService(v: unknown): v is VetService {
  return typeof v === "string" && v in SERVICE_LABEL;
}

export const LAB_TESTS = {
  RABIES_TITRE: { label: "Rabies antibody titre test", unit: "IU/mL", passAt: 0.5 },
  HEALTH_SCREEN: { label: "Pre-travel health screen", unit: null, passAt: null },
} as const;

export type LabTest = keyof typeof LAB_TESTS;

export function isLabTest(v: unknown): v is LabTest {
  return typeof v === "string" && v in LAB_TESTS;
}

/** A titre of at least 0.5 IU/mL is the internationally accepted pass mark. */
export function titreOutcome(value: number) {
  return value >= LAB_TESTS.RABIES_TITRE.passAt ? "PASS" : "FAIL";
}

export const APPOINTMENT_STATUS: Record<string, { label: string; tone: "info" | "ok" | "neutral" | "warn" }> = {
  REQUESTED: { label: "Requested", tone: "warn" },
  ACCEPTED: { label: "Confirmed", tone: "info" },
  COMPLETED: { label: "Done", tone: "ok" },
  DECLINED: { label: "Declined", tone: "neutral" },
};

export function parseServices(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

type ProviderLike = { id: string; name: string; type: string; officialVet: boolean; services: string };

/**
 * Practices that can do a step: they offer the service and, for certificates an official vet
 * must sign, have one. Official vets first, then by name, so the order is stable.
 */
export function matchProviders<P extends ProviderLike>(providers: P[], service: VetService | null, needsOfficialVet = false) {
  return providers
    .filter((p) => p.type === "VET")
    .filter((p) => !service || parseServices(p.services).includes(service))
    .filter((p) => !needsOfficialVet || p.officialVet)
    .sort((a, b) => Number(b.officialVet) - Number(a.officialVet) || a.name.localeCompare(b.name));
}

const TIMES = ["09:00", "09:30", "10:15", "11:00", "11:45", "14:00", "14:30", "15:15", "16:00", "16:45"];

function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}

function isWeekend(d: ISODate) {
  const day = new Date(`${d}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Three simulated slots on working days inside the step's window, starting tomorrow at the
 * earliest, spread across the window. The same practice and window always give the same slots.
 * Returns none when the window has already closed.
 */
export function proposeSlots(
  providerId: string,
  window: { from?: ISODate; to?: ISODate } | undefined,
  today: ISODate,
  count = 3,
): string[] {
  const start = window?.from && isAfter(window.from, today) ? window.from : addDays(today, 1);
  const end = window?.to ?? addDays(start, 28);
  if (isBefore(end, start)) return [];
  const days: ISODate[] = [];
  for (let i = 0; i <= Math.min(diffDays(end, start), 60); i++) {
    const d = addDays(start, i);
    if (!isWeekend(d)) days.push(d);
  }
  if (!days.length) return [];
  const picks = new Set<ISODate>();
  for (let k = 0; k < count && picks.size < days.length; k++) {
    picks.add(days[Math.min(days.length - 1, Math.round((k * (days.length - 1)) / Math.max(count - 1, 1)))]);
  }
  return [...picks].map((d, i) => `${d}T${TIMES[(hash(providerId + d) + i) % TIMES.length]}`);
}

/** "Wed 18 Nov, 10:15" */
export function slotLabel(slot: string) {
  const [d, t] = slot.split("T");
  const label = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${d}T00:00:00Z`),
  );
  return `${label}, ${t}`;
}

export function slotDate(slot: string): ISODate {
  return slot.slice(0, 10);
}

export function isSlot(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(v);
}
