import { ArrowRight, CheckCircle2, Plane, ShieldCheck, Stethoscope, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { CostBreakdown } from "@/components/costs/cost-summary";
import { InsurerLogo } from "@/components/insurance/insurance-picker";
import { PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { requireOwner } from "@/lib/auth/session";
import { AIRLINES } from "@/lib/flights/core";
import { listBookings } from "@/lib/flights/repository";
import { findOffer } from "@/lib/insurance/offers";
import { formatDate, todayISO } from "@/lib/rules/dates";
import { loadRules } from "@/lib/rules/repository";
import { petNames, pickTrip } from "@/lib/trips/dashboard";
import { tripCosts } from "@/lib/trips/cost-lines";
import { certificateTask } from "@/lib/trips/journey";
import { planStoredTrip, routeTitle } from "@/lib/trips/plan";
import { listTrips } from "@/lib/trips/repository";
import { APPOINTMENT_STATUS, SERVICE_LABEL, isVetService, slotLabel } from "@/lib/vets/core";
import { ownerAppointmentsForTrip } from "@/lib/vets/repository";

export const metadata: Metadata = { title: "Bookings" };

function Card({
  icon: Icon,
  title,
  done,
  children,
  action,
  testId,
}: {
  icon: LucideIcon;
  title: string;
  done: boolean;
  children: ReactNode;
  action: ReactNode;
  testId: string;
}) {
  return (
    <section data-testid={testId} className="flex flex-col rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-sage-100 text-forest-800">
            <Icon className="size-5" />
          </span>
          <h2 className="font-semibold">{title}</h2>
        </span>
        {done ? (
          <Badge tone="ok" icon={<CheckCircle2 className="size-3.5" />}>
            Done
          </Badge>
        ) : (
          <Badge tone="warn">To do</Badge>
        )}
      </div>
      <div className="mt-4 flex-1 text-sm text-ink-700">{children}</div>
      <div className="mt-5">{action}</div>
    </section>
  );
}

export default async function BookingsPage() {
  const user = await requireOwner();
  const today = todayISO();
  const [trips, { rules }] = await Promise.all([listTrips(user.id), loadRules()]);
  const trip = pickTrip(trips, undefined, today);

  if (!trip) {
    return (
      <>
        <PageHeader title="Bookings" />
        <EmptyState icon={<Plane className="size-5" />} title="No trip yet" description="Plan a trip to book vets, flights and cover." action={<ButtonLink href="/plan">Plan a trip</ButtonLink>} />
      </>
    );
  }

  const [bookings, appointments, costs] = await Promise.all([
    listBookings(user.id, trip.id),
    ownerAppointmentsForTrip(user.id, trip.id),
    tripCosts(user.id, trip, today, rules),
  ]);
  const plan = planStoredTrip(trip, today, rules);
  const cert = certificateTask(plan.pets);
  const certDone = !cert || cert.task.status === "DONE";
  const appt = appointments.find((a) => a.status !== "DECLINED" && a.status !== "CANCELLED");
  const names = petNames(trip.pets.map((p) => p.pet));
  const species = [...new Set(trip.pets.map((p) => p.pet.species))];
  const insurance = findOffer(trip.insuranceOffer, trip.destination, species);
  const legs = trip.returnDate ? 2 : 1;
  const link = (href: string, label: string, primary: boolean) => (
    <ButtonLink href={href} variant={primary ? "primary" : "secondary"} iconRight={<ArrowRight className="size-4" />}>
      {label}
    </ButtonLink>
  );

  return (
    <>
      <PageHeader title="Bookings" description={`Everything booked for ${names}, ${routeTitle(trip)}.`} />
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          testId="booking-vet"
          icon={Stethoscope}
          title="Vet appointment"
          done={certDone}
          action={
            certDone || !cert
              ? link("/app/vets", "View appointments", false)
              : link(`/app/vets?trip=${trip.id}&pet=${cert.petId}&task=${cert.task.id}`, "Book a vet", true)
          }
        >
          {appt ? (
            <>
              <p className="font-medium text-ink-900">{appt.provider.name}</p>
              <p className="text-ink-500">
                {isVetService(appt.service) ? SERVICE_LABEL[appt.service] : appt.service} · {slotLabel(appt.slot)}
              </p>
              <p className="mt-1 text-ink-500">{(APPOINTMENT_STATUS[appt.status] ?? APPOINTMENT_STATUS.REQUESTED).label}</p>
            </>
          ) : certDone ? (
            <p>The health certificate is on your plan.</p>
          ) : (
            <p>An official vet issues the health certificate. Book one in two taps.</p>
          )}
        </Card>

        <Card
          testId="booking-flights"
          icon={Plane}
          title="Flights"
          done={bookings.length >= legs}
          action={link(`/app/flights?trip=${trip.id}`, bookings.length >= legs ? "Boarding passes" : "See flights", bookings.length < legs)}
        >
          {bookings.length ? (
            <ul className="flex flex-col gap-2">
              {bookings.map((b) => {
                const a = AIRLINES[b.airline as keyof typeof AIRLINES];
                return (
                  <li key={b.id} className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {a?.logo && <img src={a.logo} alt={a.name} className="h-4 w-16 object-contain object-left" />}
                    <span className="tabular">
                      {b.fromCode} → {b.toCode} · {formatDate(b.departDate)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>We&apos;ve picked flights that accept {names}. Book both in one tap.</p>
          )}
        </Card>

        <Card
          testId="booking-insurance"
          icon={ShieldCheck}
          title="Insurance"
          done={!!insurance}
          action={link(`/app/insurance?trip=${trip.id}`, insurance ? "View policy" : "Compare cover", !insurance)}
        >
          {insurance ? (
            <>
              <InsurerLogo offer={insurance} className="h-8" />
              <p className="mt-2 font-medium text-ink-900">{insurance.plan}</p>
              <p className="text-ink-500">Vet fees up to {insurance.details.vetFees}</p>
            </>
          ) : (
            <p>Compare four travel plans for {names} and choose one.</p>
          )}
        </Card>
      </div>
      <div id="costs" className="mt-6 scroll-mt-24">
        <CostBreakdown costs={costs} />
      </div>
      <p className="mt-6 text-[13px] text-ink-500">
        Want to see the plans and pricing?{" "}
        <Link href="/app/upgrade" className="font-medium text-forest-800 hover:underline">
          View PetJet plans
        </Link>
      </p>
    </>
  );
}
