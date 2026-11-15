import { z } from "zod";
import { addDays, isAfter, isBefore, isISODate } from "@/lib/rules/dates";

/* Shared by the questionnaire (client) and the server actions, so both give the same messages. */

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((v) => (v ? v : undefined));

const optionalDate = (message: string) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || isISODate(v), message);

export const SUPPORTED_SPECIES = ["DOG", "CAT", "FERRET"] as const;

export function petProfileSchema(today: string) {
  const year = Number(today.slice(0, 4));
  return z
    .object({
      name: z.string().trim().min(1, "Enter your pet's name.").max(40, "Use 40 characters or fewer."),
      species: z.enum(SUPPORTED_SPECIES, { error: "Choose dog, cat or ferret." }),
      breed: optionalText(60, "Use 60 characters or fewer."),
      birthYear: z.coerce
        .number({ error: "Choose the year of birth." })
        .int()
        .min(year - 30, "Check the year of birth.")
        .max(year, "The year of birth can't be in the future."),
      birthMonth: z.coerce.number({ error: "Choose the month of birth." }).int().min(1).max(12),
      birthDay: z
        .union([z.literal(""), z.coerce.number().int().min(1).max(31)])
        .optional()
        .transform((v) => (v === "" || v === undefined ? undefined : v)),
      weightKg: z
        .union([z.literal(""), z.coerce.number().positive("Enter a weight above 0.").max(120, "Check the weight.")])
        .optional()
        .transform((v) => (v === "" || v === undefined ? undefined : v)),
      hasPedigree: z.boolean().nullable().optional(),
    })
    .superRefine((p, ctx) => {
      const mm = String(p.birthMonth).padStart(2, "0");
      if (p.birthDay !== undefined) {
        const date = `${p.birthYear}-${mm}-${String(p.birthDay).padStart(2, "0")}`;
        if (!isISODate(date)) {
          ctx.addIssue({ code: "custom", path: ["birthDay"], message: "That day doesn't exist in that month." });
        } else if (isAfter(date, today)) {
          ctx.addIssue({ code: "custom", path: ["birthDay"], message: "The date of birth can't be in the future." });
        }
      } else if (`${p.birthYear}-${mm}` > today.slice(0, 7)) {
        ctx.addIssue({ code: "custom", path: ["birthMonth"], message: "The date of birth can't be in the future." });
      }
    });
}

export function petHealthSchema(today: string) {
  return z
    .object({
      microchip: z.object({
        status: z.enum(["YES", "NO", "UNKNOWN"], { error: "Tell us whether your pet is microchipped." }),
        number: z
          .string()
          .optional()
          .transform((v) => (v ? v.replace(/[\s-]/g, "") : undefined))
          .refine((v) => v === undefined || /^\d{15}$/.test(v), "A standard microchip number has 15 digits."),
        implantedOn: optionalDate("Enter a valid date."),
      }),
      rabies: z.object({
        status: z.enum(["VACCINATED", "NONE", "UNKNOWN"], {
          error: "Tell us whether your pet is vaccinated against rabies.",
        }),
        lastDoseOn: optionalDate("Enter a valid date."),
        lastDoseKind: z.enum(["PRIMARY", "BOOSTER", "UNKNOWN"]).optional(),
        validUntil: optionalDate("Enter a valid date."),
      }),
    })
    .superRefine((h, ctx) => {
      if (h.microchip.implantedOn && isAfter(h.microchip.implantedOn, today)) {
        ctx.addIssue({ code: "custom", path: ["microchip", "implantedOn"], message: "This date can't be in the future." });
      }
      if (h.rabies.lastDoseOn && isAfter(h.rabies.lastDoseOn, today)) {
        ctx.addIssue({ code: "custom", path: ["rabies", "lastDoseOn"], message: "This date can't be in the future." });
      }
      if (h.rabies.lastDoseOn && h.rabies.validUntil && !isAfter(h.rabies.validUntil, h.rabies.lastDoseOn)) {
        ctx.addIssue({
          code: "custom",
          path: ["rabies", "validUntil"],
          message: "The valid-until date must be after the vaccination date.",
        });
      }
    });
}

export function tripSchema(today: string) {
  return z
    .object({
      origin: z.string().min(1, "Choose where you're travelling from."),
      destination: z.string().min(1, "Choose where you're going."),
      arrivalDate: z
        .string()
        .min(1, "Enter the date your pet arrives.")
        .refine(isISODate, "Enter a valid date."),
      noReturnYet: z.boolean().default(false),
      returnDate: optionalDate("Enter a valid date."),
      transit: z.enum(["NONE", "AIRSIDE", "LEAVES_AIRPORT"], { error: "Tell us about any stopovers." }),
      accompaniment: z.enum(["OWNER", "AUTHORISED_PERSON", "UNACCOMPANIED"], {
        error: "Tell us who your pet travels with.",
      }),
      purpose: z.enum(["PERSONAL", "COMMERCIAL"], { error: "Tell us the reason for the trip." }),
      departureAirport: optionalText(4, "Choose an airport."),
      arrivalAirport: optionalText(4, "Choose an airport."),
      petPlacement: z.enum(["CABIN", "HOLD", "NO_PREFERENCE"]).default("NO_PREFERENCE"),
    })
    .superRefine((t, ctx) => {
      if (isISODate(t.arrivalDate) && isBefore(t.arrivalDate, today)) {
        ctx.addIssue({ code: "custom", path: ["arrivalDate"], message: "The arrival date has already passed." });
      }
      if (!t.noReturnYet && !t.returnDate) {
        ctx.addIssue({
          code: "custom",
          path: ["returnDate"],
          message: "Enter your return date, or tick that you don't know it yet.",
        });
      }
      if (t.returnDate && isISODate(t.returnDate) && isISODate(t.arrivalDate) && !isAfter(t.returnDate, t.arrivalDate)) {
        ctx.addIssue({ code: "custom", path: ["returnDate"], message: "The return date must be after the arrival date." });
      }
      if (t.origin && t.destination && t.origin === t.destination) {
        ctx.addIssue({ code: "custom", path: ["destination"], message: "Choose a different country from where you start." });
      }
      if (isISODate(t.arrivalDate) && isAfter(t.arrivalDate, addDays(today, 730))) {
        ctx.addIssue({ code: "custom", path: ["arrivalDate"], message: "We can plan trips up to two years ahead." });
      }
    }, { when: () => true }); /* run even when other fields fail, so every missing detail is listed at once */
}

/** Changing an existing trip's dates. Same date rules as the questionnaire. */
export function tripDatesSchema(today: string) {
  return z
    .object({
      arrivalDate: z
        .string()
        .min(1, "Enter the date your pet arrives.")
        .refine(isISODate, "Enter a valid date."),
      noReturnYet: z.boolean().default(false),
      returnDate: optionalDate("Enter a valid date."),
    })
    .superRefine((t, ctx) => {
      if (isISODate(t.arrivalDate) && isBefore(t.arrivalDate, today)) {
        ctx.addIssue({ code: "custom", path: ["arrivalDate"], message: "The arrival date has already passed." });
      }
      if (isISODate(t.arrivalDate) && isAfter(t.arrivalDate, addDays(today, 730))) {
        ctx.addIssue({ code: "custom", path: ["arrivalDate"], message: "We can plan trips up to two years ahead." });
      }
      if (!t.noReturnYet && !t.returnDate) {
        ctx.addIssue({
          code: "custom",
          path: ["returnDate"],
          message: "Enter your return date, or tick that you don't know it yet.",
        });
      }
      if (!t.noReturnYet && t.returnDate && isISODate(t.returnDate) && isISODate(t.arrivalDate) && !isAfter(t.returnDate, t.arrivalDate)) {
        ctx.addIssue({ code: "custom", path: ["returnDate"], message: "The return date must be after the arrival date." });
      }
    }, { when: () => true });
}

export type TripDatesInput = z.input<ReturnType<typeof tripDatesSchema>>;

export function draftPetSchema(today: string) {
  return z.object({
    existingId: z.string().optional(),
    profile: petProfileSchema(today),
    health: petHealthSchema(today),
  });
}

export function draftSchema(today: string) {
  return z.object({
    pets: z
      .array(draftPetSchema(today))
      .min(1, "Add at least one pet.")
      .max(5, "PetJet plans personal trips of up to 5 pets."),
    trip: tripSchema(today),
    recordsAvailable: z.enum(["YES", "SOME", "NO"], { error: "Tell us whether you have your pet's records." }),
  });
}

export type PetProfileInput = z.input<ReturnType<typeof petProfileSchema>>;
export type PetProfile = z.output<ReturnType<typeof petProfileSchema>>;
export type PetHealthInput = z.input<ReturnType<typeof petHealthSchema>>;
export type PetHealth = z.output<ReturnType<typeof petHealthSchema>>;
export type TripDetailsInput = z.input<ReturnType<typeof tripSchema>>;
export type TripDetails = z.output<ReturnType<typeof tripSchema>>;
export type PlanDraftInput = z.input<ReturnType<typeof draftSchema>>;
export type PlanDraft = z.output<ReturnType<typeof draftSchema>>;

/** Flattens zod issues to { "trip.arrivalDate": "message" }, keeping the first message per field. */
export function issuesToErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
