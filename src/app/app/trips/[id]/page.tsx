import { AlertTriangle, CalendarDays, CheckCircle2, FlaskConical, ListChecks, Plane, Route } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClearPlanDraft } from "@/components/plan/clear-draft";
import { DeleteTripButton } from "@/components/trips/delete-trip-button";
import { PetPlanSection } from "@/components/trips/pet-plan";
import { EditDatesButton, TripEditorProvider } from "@/components/trips/trip-editor";
import { TripStatusBadge } from "@/components/trips/trip-status";
import { TripTimelineView } from "@/components/trips/trip-timeline";
import { Callout } from "@/components/ui/feedback";
import { requireOwner } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { formatDate, todayISO } from "@/lib/rules/dates";
import { loadRules } from "@/lib/rules/repository";
import { countdown, suggestDates } from "@/lib/trips/dashboard";
import { planStoredTrip, routeTitle } from "@/lib/trips/plan";
import { confirmedDocuments } from "@/lib/documents/repository";
import { RECORD_TASK, evidenceFor } from "@/lib/documents/links";
import { labOrdersForOwner, ownerAppointmentsForTrip } from "@/lib/vets/repository";
import { LAB_TESTS, slotLabel } from "@/lib/vets/core";
import { Badge } from "@/components/ui/badge";
import { getTrip } from "@/lib/trips/repository";
import { buildTimeline } from "@/lib/trips/timeline";

export const metadata: Metadata = { title: "Trip plan" };

const VIEWS = [
  { id: "checklist", label: "Checklist", icon: ListChecks },
  { id: "timeline", label: "Timeline", icon: Route },
] as const;

export default async function TripPage({ params, searchParams }: PageProps<"/app/trips/[id]">) {
  const user = await requireOwner();
  const { id } = await params;
  const { new: isNew, view: viewParam } = await searchParams;
  const view = viewParam === "timeline" ? "timeline" : "checklist";
  const trip = await getTrip(user.id, id);
  if (!trip) notFound();

  const today = todayISO();
  const petIds = trip.pets.map((p) => p.petId);
  const [{ rules }, docs, appointments, labOrders] = await Promise.all([
    loadRules(),
    confirmedDocuments(user.id, petIds),
    ownerAppointmentsForTrip(user.id, trip.id),
    labOrdersForOwner(user.id, petIds),
  ]);
  const recordedBy = (petId: string) =>
    Object.fromEntries(
      trip.taskRecords
        .filter((r) => r.petId === petId && (r.source === "VET" || r.source === "BOOKING") && r.issuedBy)
        .flatMap((r) =>
          (RECORD_TASK[r.key] ?? [r.key === "approvedRouteBooked" ? "return-approved-route" : ""]).map((t) => [
            t,
            r.source === "BOOKING" ? `Booked with ${r.issuedBy}` : `Recorded by ${r.issuedBy}`,
          ]),
        ),
    );
  const appointmentsFor = (petId: string) =>
    Object.fromEntries(
      appointments
        .filter((a) => a.pet.id === petId && a.taskId && (a.status === "REQUESTED" || a.status === "ACCEPTED"))
        .map((a) => [a.taskId!, { provider: a.provider.name, when: slotLabel(a.slot), status: a.status }]),
    );
  const plan = planStoredTrip(trip, today, rules);
  const ruleMap = new Map(rules.map((r) => [r.id, r]));
  const count = countdown(trip, today);
  const suggestion = plan.status === "NOT_FEASIBLE" ? suggestDates(trip, plan.pets, today) : null;

  return (
    <TripEditorProvider trip={trip} rules={rules} today={today}>
      <div className="flex flex-col gap-8">
        {isNew && <ClearPlanDraft />}
        <nav aria-label="Breadcrumb" className="text-sm text-ink-500">
          <Link href="/app/trips" className="hover:text-forest-800 hover:underline">
            My trips
          </Link>{" "}
          / <span className="text-ink-900">{routeTitle(trip)}</span>
        </nav>

        <header className="relative overflow-hidden rounded-card bg-forest-800 p-6 text-cream-50 shadow-raised sm:p-8">
          <Plane aria-hidden className="absolute -bottom-8 -right-6 size-44 rotate-12 text-forest-700" strokeWidth={1} />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow text-sage-300">Provisional plan</p>
              <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{routeTitle(trip)}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-sage-200">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-4" />
                  <span className="tabular" data-testid="trip-arrival">
                    Arrives {formatDate(trip.arrivalDate)}
                  </span>
                </span>
                <span className="tabular" data-testid="trip-return">
                  {trip.returnDate ? `Home ${formatDate(trip.returnDate)}` : "Return date not set"}
                </span>
                {trip.departureAirport || trip.arrivalAirport ? (
                  <span className="tabular">
                    {[trip.departureAirport, trip.arrivalAirport].filter(Boolean).join(" → ")}
                  </span>
                ) : null}
              </p>
            </div>
            <div className="text-right" data-testid="countdown">
              <p className="tabular text-4xl font-semibold tracking-tight">{count.days}</p>
              <p className="text-xs text-sage-300">{count.phase === "travel-day" ? "Travel day" : count.label}</p>
            </div>
          </div>
          <div className="relative mt-5 flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex rounded-full bg-cream-50 p-0.5" data-testid="trip-status">
              <TripStatusBadge status={plan.status} />
            </span>
            <EditDatesButton size="sm" />
          </div>
        </header>

        {isNew && (
          <Callout tone="ok" icon={<CheckCircle2 className="size-4.5" />} title="Your provisional plan is ready">
            It&apos;s built from verified rules and your answers. It firms up as you upload records and complete
            each step.
          </Callout>
        )}

        {plan.status === "NOT_FEASIBLE" && (
          <div
            role="alert"
            data-testid="date-conflict"
            className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-danger-700/20 bg-danger-100 p-5"
          >
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger-700" />
              <div>
                <p className="font-semibold text-danger-700">These dates don&apos;t work yet</p>
                <p className="mt-0.5 text-[13px] text-ink-700">
                  {suggestion
                    ? `The earliest dates that work are ${formatDate(suggestion.arrivalDate)}${suggestion.returnDate ? ` to ${formatDate(suggestion.returnDate)}` : ""}.`
                    : "Changing the dates won't fix everything. See the details below."}
                </p>
              </div>
            </div>
            {suggestion && (
              <EditDatesButton prefill={suggestion} variant="primary">
                Move my dates
              </EditDatesButton>
            )}
          </div>
        )}

        <nav aria-label="Plan views" className="-mb-2 flex gap-1 border-b border-line">
          {VIEWS.map(({ id: v, label, icon: Icon }) => {
            const active = v === view;
            return (
              <Link
                key={v}
                href={v === "checklist" ? `/app/trips/${trip.id}` : `/app/trips/${trip.id}?view=${v}`}
                aria-current={active ? "page" : undefined}
                scroll={false}
                className={cn(
                  "-mb-px inline-flex h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors",
                  active
                    ? "border-forest-800 text-forest-800"
                    : "border-transparent text-ink-500 hover:border-line-strong hover:text-ink-900",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        {view === "timeline" ? (
          <TripTimelineView
            timeline={buildTimeline(trip, plan.pets, today)}
            tripId={trip.id}
            showPets={plan.pets.length > 1}
            today={today}
          />
        ) : (
          plan.pets.map((entry) => (
            <PetPlanSection
              key={entry.pet.id}
              entry={entry}
              rules={ruleMap}
              context={{
                tripId: trip.id,
                today,
                records: trip.taskRecords.filter((r) => r.petId === entry.pet.id),
                /* Trip documents only count for this trip */
                evidence: evidenceFor(
                  trip.pets.find((p) => p.petId === entry.pet.id)!.pet,
                  docs.filter((d) => !d.tripId || d.tripId === trip.id),
                  trip.taskRecords,
                ),
                recordedBy: recordedBy(entry.pet.id),
                appointments: appointmentsFor(entry.pet.id),
              }}
            />
          ))
        )}

        {labOrders.length > 0 && (
          <section aria-label="Lab tests" data-testid="trip-lab-tests" className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-ink-500">
              <FlaskConical className="size-4" /> Lab tests
            </h2>
            <p className="mt-1 text-[13px] text-ink-500">Optional tests your vet ordered. They don&apos;t change the plan for this route.</p>
            <ul className="mt-3 flex flex-col divide-y divide-line">
              {labOrders.map((o) => {
                const t = LAB_TESTS[o.test as keyof typeof LAB_TESTS];
                const petName = trip.pets.find((p) => p.petId === o.appointment.petId)?.pet.name;
                return (
                  <li key={o.id} className="flex flex-wrap items-center gap-2 py-3 text-sm" data-testid="trip-lab-result">
                    <span className="font-medium">{t?.label ?? o.test}</span>
                    <span className="text-ink-500">
                      · {petName} · ordered by {o.appointment.provider.name}
                    </span>
                    <span className="ml-auto flex flex-wrap gap-1.5">
                      {o.status === "RESULTED" ? (
                        <>
                          <Badge tone={o.outcome === "PASS" ? "ok" : "danger"}>
                            {o.resultValue !== null ? `${o.resultValue} ${t?.unit ?? ""} · ` : ""}
                            {o.outcome === "PASS" ? "Pass" : "Below pass mark"}
                          </Badge>
                          <Badge tone="sample">Sample result</Badge>
                        </>
                      ) : (
                        <Badge tone="warn">With {o.lab.name}</Badge>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
          <p className="max-w-xl text-[13px] text-ink-500">
            This plan summarises official rules to help you prepare. It isn&apos;t legal advice. Confirm with the
            linked sources and your vet before you travel.
          </p>
          <DeleteTripButton tripId={trip.id} />
        </footer>
      </div>
    </TripEditorProvider>
  );
}
