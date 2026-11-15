"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardCheck,
  FileStack,
  Pencil,
  Plane,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { createTrip } from "@/app/actions/trips";
import { PetHealthFields, PetProfileFields } from "@/components/pets/pet-fields";
import {
  emptyHealth,
  emptyProfile,
  healthFromStored,
  healthInput,
  profileFromStored,
  profileInput,
  type HealthForm,
  type ProfileForm,
  type StoredPet,
} from "@/components/pets/pet-form-state";
import { SpeciesIcon } from "@/components/pets/species-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, ChoiceGroup } from "@/components/ui/choice";
import { Callout } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/rules/dates";
import { franceRestrictedBreed } from "@/lib/rules/engine";
import { checkCoverage, type CoverageIssue } from "@/lib/trips/coverage";
import { SPECIES_NAME, ageLabel } from "@/lib/trips/format";
import {
  ARRIVAL_AIRPORTS,
  DEPARTURE_AIRPORTS,
  DESTINATIONS,
  ORIGINS,
  countryLabel,
} from "@/lib/trips/options";
import { issuesToErrors, petHealthSchema, petProfileSchema, tripSchema } from "@/lib/trips/schemas";
import { CoverageGuidance } from "./coverage-guidance";

export const DRAFT_KEY = "petjet.plan-draft.v1";
export const SUBMIT_KEY = "petjet.plan-submit.v1";

const STEPS = ["Pet details", "Travel plans", "Health & records", "Review"];

type WizardPet = { key: string; existingId?: string; profile: ProfileForm; health: HealthForm };

type TripForm = {
  origin: string;
  destination: string;
  arrivalDate: string;
  returnDate: string;
  noReturnYet: boolean;
  transit: string;
  accompaniment: string;
  purpose: string;
  departureAirport: string;
  arrivalAirport: string;
  petPlacement: string;
};

type State = { pets: WizardPet[]; trip: TripForm; recordsAvailable: string };

const emptyTrip = (): TripForm => ({
  origin: "GB",
  destination: "",
  arrivalDate: "",
  returnDate: "",
  noReturnYet: false,
  transit: "",
  accompaniment: "",
  purpose: "",
  departureAirport: "",
  arrivalAirport: "",
  petPlacement: "NO_PREFERENCE",
});

let keySeq = 0;
const newKey = () => `pet-${Date.now().toString(36)}-${(keySeq++).toString(36)}`;

function readStorage<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Private mode or storage blocked: the questionnaire still works, it just isn't remembered */
  }
}

export function clearPlanStorage() {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
    window.localStorage.removeItem(SUBMIT_KEY);
  } catch {
    /* ignore */
  }
}

function toDraft(state: State) {
  const t = state.trip;
  return {
    pets: state.pets.map((p) => ({
      existingId: p.existingId,
      profile: profileInput(p.profile),
      health: healthInput(p.health),
    })),
    trip: {
      origin: t.origin,
      destination: t.destination,
      arrivalDate: t.arrivalDate,
      noReturnYet: t.noReturnYet,
      returnDate: t.noReturnYet ? "" : t.returnDate,
      transit: t.transit,
      accompaniment: t.accompaniment,
      purpose: t.purpose,
      departureAirport: t.departureAirport,
      arrivalAirport: t.arrivalAirport,
      petPlacement: t.petPlacement || "NO_PREFERENCE",
    },
    recordsAvailable: state.recordsAvailable,
  };
}

function prefixed(p: string, e: Record<string, string>) {
  return Object.fromEntries(Object.entries(e).map(([k, v]) => [`${p}.${k}`, v]));
}

/* ------------------------------------------------------------------ */

type WizardProps = { existingPets: StoredPet[]; today: string; signedIn: boolean };

const noopSubscribe = () => () => {};

/** Renders the questionnaire once in the browser, where saved answers can be read. */
export function PlanWizard(props: WizardProps) {
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!hydrated) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6" aria-busy="true">
        <Stepper steps={STEPS} current={0} className="mx-auto max-w-3xl" />
      </div>
    );
  }
  return <Wizard {...props} />;
}

type Saved = { state: State; step: number };

function loadSaved(existingPets: StoredPet[]): (Saved & { restored: boolean }) | null {
  const saved = readStorage<Saved>(DRAFT_KEY);
  if (!saved?.state?.trip || !Array.isArray(saved.state.pets)) return null;
  const known = new Set(existingPets.map((p) => p.id));
  const pets = saved.state.pets.filter((p) => !p.existingId || known.has(p.existingId));
  return {
    state: { ...saved.state, pets },
    step: Math.min(Math.max(0, saved.step ?? 0), 2),
    restored: pets.length > 0 || !!saved.state.trip.destination,
  };
}

function Wizard({ existingPets, today, signedIn }: WizardProps) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [initial] = useState(() => loadSaved(existingPets));
  const [state, setState] = useState<State>(
    () => initial?.state ?? { pets: [], trip: emptyTrip(), recordsAvailable: "" },
  );
  const [step, setStep] = useState(initial?.step ?? 0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  const [issues, setIssues] = useState<CoverageIssue[] | null>(null);
  const [adding, setAdding] = useState<{ key: string; profile: ProfileForm } | null>(() =>
    !initial && existingPets.length === 0 ? { key: newKey(), profile: emptyProfile() } : null,
  );
  const [restored, setRestored] = useState(initial?.restored ?? false);
  const [pending, start] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    writeStorage(DRAFT_KEY, { state, step });
  }, [state, step]);

  function go(next: number) {
    setErrors({});
    setMessage(undefined);
    setStep(next);
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
  }

  function startOver() {
    clearPlanStorage();
    setState({ pets: [], trip: emptyTrip(), recordsAvailable: "" });
    setAdding(existingPets.length === 0 ? { key: newKey(), profile: emptyProfile() } : null);
    setIssues(null);
    setRestored(false);
    go(0);
  }

  const setTrip = (trip: TripForm) => setState((s) => ({ ...s, trip }));
  const setPet = (key: string, change: Partial<WizardPet>) =>
    setState((s) => ({ ...s, pets: s.pets.map((p) => (p.key === key ? { ...p, ...change } : p)) }));

  /* ---------- Step 1: pets ---------- */

  function toggleExisting(pet: StoredPet, on: boolean) {
    setState((s) => ({
      ...s,
      pets: on
        ? [
            ...s.pets,
            { key: newKey(), existingId: pet.id, profile: profileFromStored(pet), health: healthFromStored(pet) },
          ]
        : s.pets.filter((p) => p.existingId !== pet.id),
    }));
  }

  function saveAdding() {
    if (!adding) return;
    const parsed = petProfileSchema(today).safeParse(profileInput(adding.profile));
    if (!parsed.success) {
      setErrors(prefixed("profile", issuesToErrors(parsed.error)));
      return;
    }
    setErrors({});
    setState((s) => {
      const exists = s.pets.some((p) => p.key === adding.key);
      return {
        ...s,
        pets: exists
          ? s.pets.map((p) => (p.key === adding.key ? { ...p, profile: adding.profile } : p))
          : [...s.pets, { key: adding.key, profile: adding.profile, health: emptyHealth() }],
      };
    });
    setAdding(null);
  }

  function continueFromPets() {
    if (adding) {
      setMessage("Save or cancel the pet you're adding first.");
      return;
    }
    if (state.pets.length === 0) {
      setMessage("Choose or add at least one pet.");
      return;
    }
    if (state.pets.length > 5) {
      setMessage("PetJet plans personal trips of up to 5 pets.");
      return;
    }
    go(1);
  }

  /* ---------- Step 2: trip ---------- */

  function continueFromTrip() {
    const parsed = tripSchema(today).safeParse(toDraft(state).trip);
    if (!parsed.success) {
      setErrors(prefixed("trip", issuesToErrors(parsed.error)));
      setMessage("Some travel details are missing or need checking.");
      return;
    }
    const found = checkCoverage(
      state.pets.map((p) => ({ name: p.profile.name, species: p.profile.species })),
      parsed.data,
      today,
    );
    if (found.length) {
      setIssues(found);
      window.scrollTo({ top: 0 });
      return;
    }
    go(2);
  }

  /* ---------- Step 3: health ---------- */

  function continueFromHealth() {
    const next: Record<string, string> = {};
    state.pets.forEach((p, i) => {
      const parsed = petHealthSchema(today).safeParse(healthInput(p.health));
      if (!parsed.success) Object.assign(next, prefixed(`pets.${i}.health`, issuesToErrors(parsed.error)));
    });
    if (!state.recordsAvailable) next.recordsAvailable = "Tell us whether you have your pet's records.";
    setErrors(next);
    if (Object.keys(next).length) {
      setMessage("Some health answers are missing.");
      return;
    }
    go(3);
  }

  /* ---------- Step 4: submit ---------- */

  function submit() {
    const draft = toDraft(state);
    if (!signedIn) {
      writeStorage(SUBMIT_KEY, draft);
      router.push(`/signup?next=${encodeURIComponent("/app/trips/finish")}`);
      return;
    }
    start(async () => {
      const res = await createTrip(draft);
      if (res && !res.ok) {
        if (res.issues?.length) {
          setIssues(res.issues);
          return;
        }
        const keys = Object.keys(res.errors ?? {});
        const target = keys.some((k) => /^pets\.\d+\.profile/.test(k))
          ? 0
          : keys.some((k) => k.startsWith("trip."))
            ? 1
            : keys.length
              ? 2
              : 3;
        go(target);
        setErrors(res.errors ?? {});
        setMessage(res.message ?? "Some answers need checking.");
      }
    });
  }

  /* ------------------------------------------------------------------ */

  if (issues) {
    return (
      <CoverageGuidance
        issues={issues}
        onBack={() => {
          setIssues(null);
          go(1);
        }}
      />
    );
  }

  const titles = [
    { title: "Who's travelling?", lead: "Choose the pets going on this trip, or add a new one." },
    { title: "Where are you going?", lead: "We work every deadline back from the day your pet lands." },
    { title: "Health & records", lead: "Tell us what's already done. If you're not sure, say so and we'll help you check." },
    { title: "Check your answers", lead: "We'll build a provisional plan from these. You can change them later." },
  ];

  const newPets = state.pets.filter((p) => !p.existingId);
  const t = state.trip;
  const arrivalAirports = ARRIVAL_AIRPORTS[t.destination] ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8 sm:px-6">
      <Stepper steps={STEPS} current={step} className="mx-auto max-w-3xl" />

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {restored && step === 0 && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-control border border-line bg-surface px-4 py-3 text-sm shadow-xs">
              <span className="text-ink-700">We&apos;ve kept your answers from last time.</span>
              <button
                type="button"
                onClick={startOver}
                className="inline-flex items-center gap-1.5 font-medium text-forest-800 hover:underline"
              >
                <RotateCcw className="size-3.5" /> Start over
              </button>
            </div>
          )}
          <h1 ref={heading} tabIndex={-1} className="text-3xl font-semibold outline-none sm:text-[34px]">
            {titles[step].title}
          </h1>
          <p className="mt-2 text-[15px] text-ink-500">{titles[step].lead}</p>

          {message && (
            <Callout
              tone="danger"
              icon={<AlertTriangle className="size-4.5" />}
              title={message}
              className="mt-6"
            />
          )}

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={reduce ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -16 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 flex flex-col gap-5"
            >
              {step === 0 && (
                <>
                  {existingPets.length > 0 && (
                    <Card>
                      <h2 className="text-base font-semibold">Your pets</h2>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {existingPets.map((pet) => {
                          const on = state.pets.some((p) => p.existingId === pet.id);
                          return (
                            <label
                              key={pet.id}
                              className={cn(
                                "flex cursor-pointer items-center gap-3 rounded-control border p-3 transition-colors",
                                on ? "border-forest-800 bg-sage-50 ring-1 ring-forest-800" : "border-line-strong hover:border-ink-400",
                                "has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-sage-200",
                              )}
                            >
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={on}
                                onChange={(e) => toggleExisting(pet, e.target.checked)}
                                aria-label={`${pet.name} is travelling`}
                              />
                              <span className="grid size-10 place-items-center rounded-xl bg-tan-100 text-tan-700">
                                <SpeciesIcon species={pet.species} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold">{pet.name}</span>
                                <span className="block truncate text-xs text-ink-500">
                                  {SPECIES_NAME[pet.species]} · {ageLabel(pet.birthYear, pet.birthMonth, today)}
                                </span>
                              </span>
                              <span
                                aria-hidden
                                className={cn(
                                  "grid size-5 place-items-center rounded-md border",
                                  on ? "border-forest-800 bg-forest-800 text-cream-50" : "border-line-strong",
                                )}
                              >
                                {on && <Check className="size-3.5" strokeWidth={3} />}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </Card>
                  )}

                  {newPets.length > 0 && (
                    <ul className="flex flex-col gap-2" aria-label="Pets you've added">
                      {newPets.map((p) => (
                        <li
                          key={p.key}
                          className="flex items-center gap-3 rounded-card border border-line bg-surface p-3 pl-4 shadow-xs"
                        >
                          <span className="grid size-10 place-items-center rounded-xl bg-tan-100 text-tan-700">
                            <SpeciesIcon species={p.profile.species} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{p.profile.name}</span>
                            <span className="block truncate text-xs text-ink-500">
                              {SPECIES_NAME[p.profile.species]}
                              {p.profile.breed ? ` · ${p.profile.breed}` : ""}
                            </span>
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Edit ${p.profile.name}`}
                            onClick={() => setAdding({ key: p.key, profile: p.profile })}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Remove ${p.profile.name}`}
                            onClick={() => setState((s) => ({ ...s, pets: s.pets.filter((x) => x.key !== p.key) }))}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {adding ? (
                    <Card>
                      <h2 className="mb-5 text-base font-semibold">
                        {state.pets.some((p) => p.key === adding.key) ? "Edit pet" : "Add a pet"}
                      </h2>
                      <PetProfileFields
                        value={adding.profile}
                        onChange={(profile) => setAdding({ ...adding, profile })}
                        errors={errors}
                        today={today}
                      />
                      <div className="mt-6 flex justify-end gap-2">
                        {(state.pets.length > 0 || existingPets.length > 0) && (
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setAdding(null);
                              setErrors({});
                            }}
                          >
                            Cancel
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          onClick={saveAdding}
                          disabled={adding.profile.species === "OTHER"}
                        >
                          Save pet
                        </Button>
                      </div>
                    </Card>
                  ) : (
                    state.pets.length < 5 && (
                      <button
                        type="button"
                        onClick={() => {
                          setAdding({ key: newKey(), profile: emptyProfile() });
                          setMessage(undefined);
                        }}
                        className="flex items-center justify-center gap-2 rounded-card border border-dashed border-line-strong bg-cream-50 px-4 py-5 text-sm font-medium text-forest-800 transition-colors hover:border-forest-700/40 hover:bg-sage-50"
                      >
                        <Plus className="size-4" /> {state.pets.length ? "Add another pet" : "Add a pet"}
                      </button>
                    )
                  )}
                </>
              )}

              {step === 1 && (
                <>
                  <Card className="flex flex-col gap-5">
                    <h2 className="text-base font-semibold">Your trip</h2>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Select
                        label="Travelling from"
                        value={t.origin}
                        onChange={(e) => setTrip({ ...t, origin: e.target.value, departureAirport: "" })}
                        error={errors["trip.origin"]}
                      >
                        {ORIGINS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                      <Select
                        label="Going to"
                        value={t.destination}
                        onChange={(e) => setTrip({ ...t, destination: e.target.value, arrivalAirport: "" })}
                        error={errors["trip.destination"]}
                      >
                        <option value="">Choose a country</option>
                        {DESTINATIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                      <Input
                        label="Date your pet arrives"
                        type="date"
                        min={today}
                        value={t.arrivalDate}
                        onChange={(e) => setTrip({ ...t, arrivalDate: e.target.value })}
                        error={errors["trip.arrivalDate"]}
                        hint="For overnight flights, use the landing date."
                      />
                      <div className="flex flex-col gap-2.5">
                        <Input
                          label="Date you come home"
                          type="date"
                          min={t.arrivalDate || today}
                          value={t.noReturnYet ? "" : t.returnDate}
                          disabled={t.noReturnYet}
                          onChange={(e) => setTrip({ ...t, returnDate: e.target.value })}
                          error={errors["trip.returnDate"]}
                        />
                        <Checkbox
                          label="I don't know my return date yet"
                          checked={t.noReturnYet}
                          onChange={(v) => setTrip({ ...t, noReturnYet: v, returnDate: v ? "" : t.returnDate })}
                        />
                      </div>
                    </div>
                    <ChoiceGroup
                      legend="Does the flight stop anywhere on the way?"
                      name="transit"
                      columns={3}
                      options={[
                        { value: "NONE", label: "No, it's direct" },
                        { value: "AIRSIDE", label: "Yes, pet stays in the airport", description: "Changing planes only" },
                        { value: "LEAVES_AIRPORT", label: "Yes, pet leaves the airport", description: "Staying over in that country" },
                      ]}
                      value={t.transit}
                      onChange={(v) => setTrip({ ...t, transit: v })}
                      error={errors["trip.transit"]}
                    />
                    <ChoiceGroup
                      legend="Who does your pet travel with?"
                      name="accompaniment"
                      columns={3}
                      options={[
                        { value: "OWNER", label: "With me" },
                        { value: "AUTHORISED_PERSON", label: "Someone I authorise", description: "Within 5 days of my trip" },
                        { value: "UNACCOMPANIED", label: "On its own" },
                      ]}
                      value={t.accompaniment}
                      onChange={(v) => setTrip({ ...t, accompaniment: v })}
                      error={errors["trip.accompaniment"]}
                    />
                    <ChoiceGroup
                      legend="What's the trip for?"
                      name="purpose"
                      columns={2}
                      options={[
                        { value: "PERSONAL", label: "Travelling or moving with my pet" },
                        { value: "COMMERCIAL", label: "Selling or rehoming my pet" },
                      ]}
                      value={t.purpose}
                      onChange={(v) => setTrip({ ...t, purpose: v })}
                      error={errors["trip.purpose"]}
                    />
                  </Card>

                  <Card className="flex flex-col gap-5">
                    <div>
                      <h2 className="flex items-center gap-2 text-base font-semibold">
                        <Plane className="size-4 text-tan-600" /> Your flight
                      </h2>
                      <p className="mt-1 text-sm text-ink-500">
                        Optional for now. It helps us check entry points and match pet-friendly flights later.
                      </p>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Select
                        label="Flying from"
                        optional
                        value={t.departureAirport}
                        onChange={(e) => setTrip({ ...t, departureAirport: e.target.value })}
                        disabled={t.origin !== "GB"}
                      >
                        <option value="">Not decided</option>
                        {DEPARTURE_AIRPORTS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                      <Select
                        label="Landing at"
                        optional
                        value={t.arrivalAirport}
                        onChange={(e) => setTrip({ ...t, arrivalAirport: e.target.value })}
                        disabled={arrivalAirports.length === 0}
                      >
                        <option value="">Not decided</option>
                        {arrivalAirports.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <ChoiceGroup
                      legend="Where would you like your pet to travel?"
                      hint="Airlines set their own rules on size and breed. We'll check them when you choose a flight."
                      name="petPlacement"
                      columns={3}
                      size="sm"
                      options={[
                        { value: "CABIN", label: "In the cabin with me" },
                        { value: "HOLD", label: "In the hold" },
                        { value: "NO_PREFERENCE", label: "No preference" },
                      ]}
                      value={t.petPlacement}
                      onChange={(v) => setTrip({ ...t, petPlacement: v })}
                    />
                  </Card>
                </>
              )}

              {step === 2 && (
                <>
                  {state.pets.map((p, i) => {
                    const askPedigree =
                      t.destination === "FR" && p.profile.species === "DOG" && !!franceRestrictedBreed(p.profile.breed);
                    const errs = Object.fromEntries(
                      Object.entries(errors)
                        .filter(([k]) => k.startsWith(`pets.${i}.`))
                        .map(([k, v]) => [k.replace(`pets.${i}.`, ""), v]),
                    );
                    return (
                      <Card key={p.key} data-testid={`health-${p.profile.name}`}>
                        <div className="mb-5 flex items-center gap-3">
                          <span className="grid size-10 place-items-center rounded-xl bg-tan-100 text-tan-700">
                            <SpeciesIcon species={p.profile.species} />
                          </span>
                          <h2 className="text-lg font-semibold">{p.profile.name}</h2>
                        </div>
                        <PetHealthFields
                          petName={p.profile.name}
                          value={p.health}
                          onChange={(health) => setPet(p.key, { health })}
                          errors={errs}
                          today={today}
                        />
                        {askPedigree && (
                          <div className="mt-6">
                            <ChoiceGroup
                              legend={`France restricts ${p.profile.breed} type dogs. Does ${p.profile.name} have a recognised pedigree?`}
                              name={`pedigree-${p.key}`}
                              columns={3}
                              size="sm"
                              options={[
                                { value: "yes", label: "Yes" },
                                { value: "no", label: "No" },
                                { value: "unknown", label: "Not sure" },
                              ]}
                              value={
                                p.profile.hasPedigree === true ? "yes" : p.profile.hasPedigree === false ? "no" : "unknown"
                              }
                              onChange={(v) =>
                                setPet(p.key, {
                                  profile: { ...p.profile, hasPedigree: v === "yes" ? true : v === "no" ? false : null },
                                })
                              }
                            />
                          </div>
                        )}
                      </Card>
                    );
                  })}
                  <Card>
                    <ChoiceGroup
                      legend="Do you have your pets' microchip and vaccination records?"
                      hint="You'll upload them after your plan is built, and we'll check them against these answers."
                      name="records"
                      columns={3}
                      options={[
                        { value: "YES", label: "Yes, all of them", icon: <FileStack className="size-4" /> },
                        { value: "SOME", label: "Some of them", icon: <FileStack className="size-4" /> },
                        { value: "NO", label: "Not yet", icon: <FileStack className="size-4" /> },
                      ]}
                      value={state.recordsAvailable}
                      onChange={(v) => setState((s) => ({ ...s, recordsAvailable: v }))}
                      error={errors.recordsAvailable}
                    />
                  </Card>
                </>
              )}

              {step === 3 && <Review state={state} today={today} onEdit={go} />}
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex items-center justify-between gap-3">
            {step > 0 ? (
              <Button variant="ghost" iconLeft={<ArrowLeft className="size-4" />} onClick={() => go(step - 1)}>
                Back
              </Button>
            ) : (
              <span />
            )}
            {step === 0 && (
              <Button size="lg" iconRight={<ArrowRight className="size-4" />} onClick={continueFromPets}>
                Continue
              </Button>
            )}
            {step === 1 && (
              <Button size="lg" iconRight={<ArrowRight className="size-4" />} onClick={continueFromTrip}>
                Continue
              </Button>
            )}
            {step === 2 && (
              <Button size="lg" iconRight={<ArrowRight className="size-4" />} onClick={continueFromHealth}>
                Continue
              </Button>
            )}
            {step === 3 && (
              <Button size="lg" loading={pending} iconRight={<ArrowRight className="size-4" />} onClick={submit}>
                {signedIn ? "Build my plan" : "Create account and build my plan"}
              </Button>
            )}
          </div>
          {step === 3 && !signedIn && (
            <p className="mt-4 text-right text-sm text-ink-500">
              Already have an account?{" "}
              <Link
                href={`/login?next=${encodeURIComponent("/app/trips/finish")}`}
                onClick={() => writeStorage(SUBMIT_KEY, toDraft(state))}
                className="font-medium text-forest-800 underline-offset-4 hover:underline"
              >
                Log in to save it
              </Link>
            </p>
          )}
        </div>

        <Aside step={step} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Aside({ step }: { step: number }) {
  const content = [
    {
      icon: <ClipboardCheck className="size-6" />,
      title: "One plan per pet",
      body: "Up to 5 pets can travel on a trip. Each gets its own checklist, because their ages and records differ.",
    },
    {
      icon: <Plane className="size-6" />,
      title: "Dates matter",
      body: "Rabies waits, certificate windows and tapeworm timings all count back from the day your pet lands.",
    },
    {
      icon: <FileStack className="size-6" />,
      title: "Not sure? That's fine",
      body: "We never assume a step is done. Anything unknown becomes a task to check, not a guess.",
    },
    {
      icon: <Check className="size-6" />,
      title: "A provisional plan",
      body: "Your plan is built from official rules. It becomes firm as your records are checked and appointments are made.",
    },
  ][step];
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-24 rounded-card border border-sage-200 bg-sage-100 p-6">
        <span className="grid size-12 place-items-center rounded-2xl bg-surface text-forest-800 shadow-xs">
          {content.icon}
        </span>
        <h2 className="mt-5 text-lg font-semibold">{content.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-700">{content.body}</p>
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-line py-2.5 text-sm last:border-b-0">
      <dt className="text-ink-500">{label}</dt>
      <dd className="font-medium text-ink-900">{value}</dd>
    </div>
  );
}

const yesNo: Record<string, string> = { YES: "Yes", NO: "No", UNKNOWN: "Not sure", VACCINATED: "Yes", NONE: "No" };

function Review({ state, today, onEdit }: { state: State; today: string; onEdit: (step: number) => void }) {
  const t = state.trip;
  const edit = (n: number, label: string) => (
    <Button variant="ghost" size="sm" iconLeft={<Pencil className="size-3.5" />} onClick={() => onEdit(n)} aria-label={label}>
      Change
    </Button>
  );
  return (
    <>
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold">Pets</h2>
          {edit(0, "Change pets")}
        </div>
        <div className="flex flex-col gap-4">
          {state.pets.map((p) => (
            <div key={p.key} className="rounded-control border border-line p-4" data-testid={`review-${p.profile.name}`}>
              <p className="flex items-center gap-2 font-semibold">
                <SpeciesIcon species={p.profile.species} className="size-4 text-tan-600" />
                {p.profile.name}
                <span className="text-sm font-normal text-ink-500">
                  {SPECIES_NAME[p.profile.species]}
                  {p.profile.breed ? ` · ${p.profile.breed}` : ""} ·{" "}
                  {ageLabel(Number(p.profile.birthYear), Number(p.profile.birthMonth), today)}
                </span>
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge tone={p.health.microchipStatus === "YES" ? "ok" : p.health.microchipStatus === "NO" ? "neutral" : "warn"}>
                  Microchip: {yesNo[p.health.microchipStatus]}
                </Badge>
                <Badge tone={p.health.rabiesStatus === "VACCINATED" ? "ok" : p.health.rabiesStatus === "NONE" ? "neutral" : "warn"}>
                  Rabies vaccine: {yesNo[p.health.rabiesStatus]}
                  {p.health.rabiesStatus === "VACCINATED" && p.health.rabiesLastDose ? `, ${formatDate(p.health.rabiesLastDose)}` : ""}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold">Trip</h2>
          {edit(1, "Change trip")}
        </div>
        <dl>
          <Row label="Route" value={`${countryLabel(t.origin)} to ${countryLabel(t.destination)}`} />
          <Row label="Arrives" value={t.arrivalDate ? formatDate(t.arrivalDate) : "—"} />
          <Row label="Comes home" value={t.noReturnYet || !t.returnDate ? "Not decided yet" : formatDate(t.returnDate)} />
          <Row label="Stopover" value={t.transit === "AIRSIDE" ? "Yes, stays in the airport" : "Direct"} />
          <Row label="Travels with" value={t.accompaniment === "AUTHORISED_PERSON" ? "Someone you authorise" : "You"} />
          <Row
            label="Flight"
            value={
              [t.departureAirport, t.arrivalAirport].filter(Boolean).join(" → ") || "Not decided yet"
            }
          />
        </dl>
      </Card>
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Records</h2>
          {edit(2, "Change health answers")}
        </div>
        <p className="mt-1 text-sm text-ink-700">
          {state.recordsAvailable === "YES" ? "You have all the records." : state.recordsAvailable === "SOME" ? "You have some of the records." : "You don't have the records yet."}
        </p>
      </Card>
    </>
  );
}
