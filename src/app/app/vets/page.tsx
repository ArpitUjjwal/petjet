import { BadgeCheck, CalendarCheck, CheckCircle2, FlaskConical, MapPin, Stethoscope } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/shell/app-shell";
import { BookVet } from "@/components/vets/book-vet";
import { VetSuccess } from "@/components/vets/vet-success";
import { Badge } from "@/components/ui/badge";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { requireOwner } from "@/lib/auth/session";
import { simulationOn } from "@/lib/demo/simulate";
import { DOC_TYPE_LABEL, isDocType } from "@/lib/documents/extract";
import { listDocuments } from "@/lib/documents/repository";
import { todayISO } from "@/lib/rules/dates";
import { loadRules } from "@/lib/rules/repository";
import { windowLabel } from "@/lib/trips/format";
import { routeTitle } from "@/lib/trips/plan";
import { getTrip } from "@/lib/trips/repository";
import {
  APPOINTMENT_STATUS,
  LAB_TESTS,
  SERVICE_LABEL,
  isVetService,
  matchProviders,
  parseServices,
  proposeSlots,
  slotLabel,
} from "@/lib/vets/core";
import { findTask, listOwnerAppointments, listVets } from "@/lib/vets/repository";

export const metadata: Metadata = { title: "Vets & labs" };

export default async function VetsPage({ searchParams }: PageProps<"/app/vets">) {
  const user = await requireOwner();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const today = todayISO();
  const [vets, appointments, { rules }] = await Promise.all([listVets(), listOwnerAppointments(user.id), loadRules()]);

  /* Booking for a specific plan step, arriving from the checklist */
  const trip = str("trip") ? await getTrip(user.id, str("trip")!) : null;
  const pet = trip?.pets.find((p) => p.petId === str("pet"))?.pet;
  const task = trip && pet && str("task") ? findTask(trip, pet.id, str("task")!, today, rules) : undefined;
  const service = task?.service && isVetService(task.service) ? task.service : null;
  const booking = trip && pet && task && service ? { trip, pet, task, service } : null;
  const shown = matchProviders(vets, booking?.service ?? null, booking?.task.officialVet ?? false);
  const docs = booking ? (await listDocuments(user.id)).filter((d) => d.petId === booking.pet.id) : [];
  const requested = appointments.find((a) => a.id === str("requested"));
  const simulated = str("simulated");
  const prefill = simulationOn(user.email);

  return (
    <>
      <PageHeader
        title={booking ? `Find a vet: ${SERVICE_LABEL[booking.service]}` : "Vets & labs"}
        description={
          booking
            ? `For ${booking.pet.name}, ${routeTitle(booking.trip)}${windowLabel(booking.task.window) ? ` · needed ${windowLabel(booking.task.window)!.replace(/^By/, "by")}` : ""}.`
            : "Partner practices matched to the steps in your plan. Book from any step in your checklist."
        }
      />

      {requested && simulated && (
        <VetSuccess
          practice={requested.provider.name}
          when={`${isVetService(requested.service) ? SERVICE_LABEL[requested.service] : requested.service} for ${requested.pet.name} · ${slotLabel(requested.slot)}`}
          steps={[
            "Request sent with Bella's records",
            `${requested.provider.name} accepted`,
            ...(simulated === "recorded"
              ? ["Appointment completed", `${isVetService(requested.service) ? SERVICE_LABEL[requested.service] : "Visit"} recorded on your plan`]
              : []),
          ].map((s) => s.replace("Bella", requested.pet.name))}
          homeHref={requested.trip ? `/app?trip=${requested.trip.id}` : "/app"}
        />
      )}

      {requested && !simulated && (
        <Callout tone="ok" icon={<CheckCircle2 className="size-4.5" />} title={`Request sent to ${requested.provider.name}`} className="mb-6">
          {slotLabel(requested.slot)}. You&apos;ll see here when they confirm.
        </Callout>
      )}

      {appointments.length > 0 && (
        <section aria-label="Your appointments" className="mb-8">
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-500">Your appointments</h2>
          <ul className="flex flex-col gap-3">
            {appointments.map((a) => {
              const st = APPOINTMENT_STATUS[a.status] ?? APPOINTMENT_STATUS.REQUESTED;
              return (
                <li key={a.id} data-testid="owner-appointment" data-status={a.status} className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sage-100 text-forest-800">
                        <CalendarCheck className="size-5" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold">
                          {isVetService(a.service) ? SERVICE_LABEL[a.service] : a.service} · {a.pet.name}
                        </p>
                        <p className="tabular mt-0.5 text-[13px] text-ink-500">
                          {a.provider.name} · {slotLabel(a.slot)}
                          {a.trip ? ` · ${routeTitle(a.trip)}` : ""}
                        </p>
                        {a.documents.length > 0 && (
                          <p className="mt-1 text-xs text-ink-500">Shared: {a.documents.map((d) => d.document.fileName).join(", ")}</p>
                        )}
                      </div>
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  {a.labOrders.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
                      {a.labOrders.map((o) => {
                        const t = LAB_TESTS[o.test as keyof typeof LAB_TESTS];
                        return (
                          <li key={o.id} data-testid="lab-result" className="flex flex-wrap items-center gap-2 text-[13px]">
                            <FlaskConical className="size-4 text-tan-600" />
                            <span className="font-medium">{t?.label ?? o.test}</span>
                            <span className="text-ink-500">· {o.lab.name}</span>
                            {o.status === "RESULTED" ? (
                              <Badge tone={o.outcome === "PASS" ? "ok" : "danger"}>
                                {o.resultValue !== null ? `${o.resultValue} ${t?.unit ?? ""} · ` : ""}
                                {o.outcome === "PASS" ? "Pass" : "Below pass mark"}
                              </Badge>
                            ) : (
                              <Badge tone="warn">Awaiting result</Badge>
                            )}
                            {o.status === "RESULTED" && <Badge tone="sample">Sample result</Badge>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-label="Practices">
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-500">
          {booking ? `${shown.length} practice${shown.length === 1 ? "" : "s"} can do this` : "Partner practices"}
        </h2>
        {booking?.task.officialVet && (
          <p className="mb-3 text-[13px] text-ink-500">This certificate must be signed by an official vet, so only practices with one are shown.</p>
        )}
        {shown.length === 0 ? (
          <EmptyState icon={<Stethoscope className="size-5" />} title="No partner practice offers this yet" description="Ask your usual vet. They can record it, and you can upload the record in Documents." />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {shown.map((v, i) => (
              <li
                key={v.id}
                data-testid="vet-card"
                className={cn(
                  "flex flex-col rounded-card border bg-surface p-5",
                  booking && i === 0 ? "border-forest-800 shadow-raised md:col-span-2" : "border-line shadow-card",
                )}
              >
                {booking && i === 0 && (
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-forest-700">Best match for {booking.pet.name}</p>
                )}
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-forest-800 text-cream-50">
                    <Stethoscope className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{v.name}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[13px] text-ink-500">
                      <MapPin className="size-3.5" /> {v.city} {v.postcode}
                    </p>
                  </div>
                  {v.officialVet && (
                    <Badge tone="brand" icon={<BadgeCheck className="size-3.5" />}>
                      Official vet
                    </Badge>
                  )}
                </div>
                {v.blurb && <p className="mt-3 text-sm text-ink-700">{v.blurb}</p>}
                <p className="mt-3 flex flex-wrap gap-1.5">
                  {parseServices(v.services)
                    .filter(isVetService)
                    .map((s) => (
                      <span key={s} className="rounded-full bg-cream-200 px-2 py-0.5 text-[11px] font-medium text-ink-700">
                        {SERVICE_LABEL[s]}
                      </span>
                    ))}
                </p>
                <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                  <span className="text-xs text-ink-400">RCVS registered · verified partner</span>
                  {booking ? (
                    <BookVet
                      provider={{ id: v.id, name: v.name }}
                      slots={proposeSlots(v.id, booking.task.window, today)}
                      documents={docs.map((d) => ({
                        id: d.id,
                        fileName: d.fileName,
                        label: isDocType(d.type) && d.type !== "OTHER" ? DOC_TYPE_LABEL[d.type] : "Other document",
                        confirmed: d.status === "CONFIRMED",
                      }))}
                      prefill={prefill && i === 0}
                      context={{
                        petId: booking.pet.id,
                        petName: booking.pet.name,
                        tripId: booking.trip.id,
                        taskId: booking.task.id,
                        service: booking.service,
                        serviceLabel: SERVICE_LABEL[booking.service],
                      }}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        {!booking && (
          <p className="mt-4 text-[13px] text-ink-500">
            To book, open a step such as the animal health certificate in{" "}
            <Link href="/app/trips" className="font-medium text-forest-800 hover:underline">
              your trip&apos;s checklist
            </Link>{" "}
            and choose Find a vet.
          </p>
        )}
      </section>
    </>
  );
}
