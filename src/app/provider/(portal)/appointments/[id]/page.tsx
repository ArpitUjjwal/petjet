import { CheckCircle2, ExternalLink, FileText, FlaskConical, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SpeciesIcon } from "@/components/pets/species-icon";
import { OrderLabTest, RecordServiceForm, RespondButtons } from "@/components/provider/provider-actions";
import { TripStatusBadge } from "@/components/trips/trip-status";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/feedback";
import { requireProvider } from "@/lib/auth/session";
import { DOC_TYPE_LABEL, isDocType } from "@/lib/documents/extract";
import { formatDate, todayISO } from "@/lib/rules/dates";
import { loadRules } from "@/lib/rules/repository";
import { SPECIES_NAME, windowLabel } from "@/lib/trips/format";
import { planStoredTrip, routeTitle } from "@/lib/trips/plan";
import { APPOINTMENT_STATUS, LAB_TESTS, SERVICE_LABEL, isVetService, slotLabel } from "@/lib/vets/core";
import { getProviderAppointment } from "@/lib/vets/repository";

export const metadata: Metadata = { title: "Appointment" };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
      <dt className="text-ink-500">{label}</dt>
      <dd className="tabular text-right font-medium">{value}</dd>
    </div>
  );
}

export default async function AppointmentPage({ params }: PageProps<"/provider/appointments/[id]">) {
  const user = await requireProvider();
  if (user.role !== "VET") notFound();
  const { id } = await params;
  const appt = await getProviderAppointment(user.provider.id, id);
  if (!appt) notFound();
  const today = todayISO();
  const { rules } = await loadRules();
  const service = isVetService(appt.service) ? appt.service : null;
  const st = APPOINTMENT_STATUS[appt.status];
  const plan = appt.trip ? planStoredTrip(appt.trip, today, rules) : null;
  const petPlan = plan?.pets[0]?.plan;
  const task = petPlan?.supported && appt.taskId ? petPlan.tasks.find((t) => t.id === appt.taskId) : undefined;
  const pet = appt.pet;
  const certificate = service === "ANIMAL_HEALTH_CERTIFICATE";

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-500">
        <Link href="/provider" className="hover:text-forest-800 hover:underline">
          Requests
        </Link>{" "}
        / <span className="text-ink-900">{pet.name}</span>
      </nav>

      <header className="flex flex-wrap items-center gap-4">
        <span className="grid size-12 place-items-center rounded-2xl bg-tan-100 text-tan-700">
          <SpeciesIcon species={pet.species} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold sm:text-[28px]">
            {service ? SERVICE_LABEL[service] : appt.service} for {pet.name}
          </h1>
          <p className="tabular mt-0.5 text-sm text-ink-500">
            {slotLabel(appt.slot)} · owner {appt.owner.name}
          </p>
        </div>
        <span data-testid="appointment-status" data-status={appt.status}>
          <Badge tone={st?.tone ?? "neutral"}>{st?.label ?? appt.status}</Badge>
        </span>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="flex flex-col gap-6">
          <section aria-label="Pet" className="rounded-card border border-line bg-surface p-5 shadow-card">
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-500">Pet</h2>
            <dl className="mt-2 divide-y divide-line">
              <Row label="Name" value={pet.name} />
              <Row label="Species" value={`${SPECIES_NAME[pet.species] ?? pet.species}${pet.breed ? ` · ${pet.breed}` : ""}`} />
              <Row label="Microchip" value={pet.microchipNumber ? `${pet.microchipNumber}${pet.microchipDate ? ` · ${formatDate(pet.microchipDate)}` : ""}` : "Not recorded"} />
              <Row
                label="Rabies"
                value={
                  pet.rabiesStatus === "VACCINATED" && pet.rabiesLastDose
                    ? `${formatDate(pet.rabiesLastDose)}${pet.rabiesValidUntil ? `, valid to ${formatDate(pet.rabiesValidUntil)}` : ""}`
                    : pet.rabiesStatus === "NONE"
                      ? "Not vaccinated"
                      : "Not known"
                }
              />
            </dl>
          </section>

          {appt.trip && (
            <section aria-label="Trip" className="rounded-card border border-line bg-surface p-5 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-500">Trip</h2>
                {plan && <TripStatusBadge status={plan.status} />}
              </div>
              <dl className="mt-2 divide-y divide-line">
                <Row label="Route" value={routeTitle(appt.trip)} />
                <Row label="Arrives" value={formatDate(appt.trip.arrivalDate)} />
                {appt.trip.returnDate && <Row label="Home" value={formatDate(appt.trip.returnDate)} />}
                {task && <Row label="This step" value={`${task.title}${windowLabel(task.window) ? ` · ${windowLabel(task.window)}` : ""}`} />}
              </dl>
              {task?.detail && <p className="mt-3 rounded-control bg-cream-50 p-3 text-[13px] text-ink-700">{task.detail}</p>}
            </section>
          )}

          <section aria-label="Shared records" className="rounded-card border border-line bg-surface p-5 shadow-card">
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-500">Records shared with you</h2>
            {appt.documents.length === 0 ? (
              <p className="mt-2 text-sm text-ink-500">The owner didn&apos;t share any records.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {appt.documents.map(({ document: d }) => (
                  <li key={d.id}>
                    <a
                      href={`/provider/documents/${d.id}/file`}
                      target="_blank"
                      rel="noreferrer"
                      data-testid="shared-document"
                      className="group flex items-center gap-3 rounded-control border border-line p-3 transition-colors hover:bg-cream-50"
                    >
                      <FileText className="size-4 shrink-0 text-ink-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium group-hover:text-forest-800">
                          {isDocType(d.type) && d.type !== "OTHER" ? DOC_TYPE_LABEL[d.type] : "Other document"}
                        </span>
                        <span className="block truncate text-xs text-ink-500">{d.fileName}</span>
                      </span>
                      {d.status === "CONFIRMED" && <Badge tone="ok">Checked by owner</Badge>}
                      <ExternalLink className="size-3.5 text-ink-400" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-500">
              <Lock className="size-3" /> Shared by the owner for this appointment only.
            </p>
          </section>

          {appt.ownerNote && (
            <Callout tone="info" title="Note from the owner">
              {appt.ownerNote}
            </Callout>
          )}
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          <section aria-label="Actions" className="rounded-card border border-line bg-surface p-5 shadow-card">
            {appt.status === "REQUESTED" && (
              <>
                <h2 className="text-base font-semibold">New request</h2>
                <p className="mb-4 mt-1 text-sm text-ink-500">Confirm the time to see {pet.name}.</p>
                <RespondButtons id={appt.id} />
              </>
            )}
            {appt.status === "ACCEPTED" && service && (
              <>
                <h2 className="text-base font-semibold">{certificate ? "Issue the certificate" : "Record the appointment"}</h2>
                <p className="mb-4 mt-1 text-sm text-ink-500">This completes the step in the owner&apos;s plan.</p>
                <RecordServiceForm id={appt.id} service={service} today={today} certificate={certificate} />
              </>
            )}
            {appt.status === "COMPLETED" && (
              <p className="flex gap-2 text-sm text-ok-700">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                Recorded. The owner&apos;s plan has been updated.
              </p>
            )}
            {appt.status === "DECLINED" && <p className="text-sm text-ink-500">You declined this request. Shared records are no longer available.</p>}
          </section>

          {(appt.status === "ACCEPTED" || appt.status === "COMPLETED") && (
            <section aria-label="Lab tests" className="rounded-card border border-line bg-surface p-5 shadow-card">
              <OrderLabTest id={appt.id} />
              {appt.labOrders.length > 0 && (
                <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
                  {appt.labOrders.map((o) => {
                    const t = LAB_TESTS[o.test as keyof typeof LAB_TESTS];
                    return (
                      <li key={o.id} data-testid="vet-lab-order" className="flex flex-wrap items-center gap-2 text-[13px]">
                        <FlaskConical className="size-4 text-tan-600" />
                        <span className="font-medium">{t?.label ?? o.test}</span>
                        {o.status === "RESULTED" ? (
                          <Badge tone={o.outcome === "PASS" ? "ok" : "danger"}>
                            {o.resultValue !== null ? `${o.resultValue} ${t?.unit ?? ""} · ` : ""}
                            {o.outcome === "PASS" ? "Pass" : "Below pass mark"}
                          </Badge>
                        ) : (
                          <Badge tone="warn">With {o.lab.name}</Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
