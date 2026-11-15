import { ArrowRight, BadgeCheck, FileText, FlaskConical, Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SpeciesIcon } from "@/components/pets/species-icon";
import { PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { requireProvider } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { formatDate, toISODate } from "@/lib/rules/dates";
import { routeTitle } from "@/lib/trips/plan";
import { APPOINTMENT_STATUS, LAB_TESTS, SERVICE_LABEL, isVetService, slotLabel } from "@/lib/vets/core";
import { listLabOrders, listProviderAppointments } from "@/lib/vets/repository";

export const metadata: Metadata = { title: "Provider portal" };

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-ink-500">
        {title}
        <span className="tabular rounded-full bg-cream-200 px-2 text-[11px] text-ink-700">{count}</span>
      </h2>
      {children}
    </section>
  );
}

const rowClass =
  "group flex items-center gap-4 border-b border-line px-4 py-3.5 transition-colors last:border-b-0 hover:bg-cream-50 sm:px-5";

export default async function ProviderHome() {
  const user = await requireProvider();
  const isLab = user.role === "LAB";
  const header = (
    <PageHeader
      title={isLab ? "Test orders" : "Appointment requests"}
      description={user.provider.name}
      action={
        user.provider.verified ? (
          <Badge tone="ok" icon={<BadgeCheck className="size-3.5" />}>
            Verified partner
          </Badge>
        ) : (
          <Badge tone="warn">Verification pending</Badge>
        )
      }
    />
  );

  if (isLab) {
    const orders = await listLabOrders(user.provider.id);
    const open = orders.filter((o) => o.status === "ORDERED");
    const done = orders.filter((o) => o.status !== "ORDERED");
    const list = (items: typeof orders) => (
      <ul className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        {items.map((o) => (
          <li key={o.id}>
            <Link href={`/provider/lab-orders/${o.id}`} data-testid="lab-order-row" className={rowClass}>
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-tan-100 text-tan-700">
                <FlaskConical className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold group-hover:text-forest-800">
                  {LAB_TESTS[o.test as keyof typeof LAB_TESTS]?.label ?? o.test} · {o.appointment.pet.name}
                </span>
                <span className="tabular block truncate text-xs text-ink-500">
                  Ordered by {o.appointment.provider.name} · {formatDate(toISODate(o.createdAt))}
                </span>
              </span>
              {o.status === "RESULTED" ? (
                <Badge tone={o.outcome === "PASS" ? "ok" : "danger"}>{o.outcome === "PASS" ? "Pass" : "Fail"}</Badge>
              ) : (
                <Badge tone="warn">Awaiting result</Badge>
              )}
              <ArrowRight className="size-4 shrink-0 text-ink-400" />
            </Link>
          </li>
        ))}
      </ul>
    );
    return (
      <>
        {header}
        {orders.length === 0 ? (
          <EmptyState icon={<Inbox className="size-5" />} title="No test orders yet" description="Tests ordered by partner vets will appear here." />
        ) : (
          <>
            <Section title="To do" count={open.length}>
              {open.length ? list(open) : <p className="text-sm text-ink-500">Nothing waiting.</p>}
            </Section>
            {done.length > 0 && (
              <Section title="Resulted" count={done.length}>
                {list(done)}
              </Section>
            )}
          </>
        )}
      </>
    );
  }

  const appts = await listProviderAppointments(user.provider.id);
  const groups = [
    { title: "New requests", items: appts.filter((a) => a.status === "REQUESTED") },
    { title: "Upcoming", items: appts.filter((a) => a.status === "ACCEPTED") },
    { title: "Done", items: appts.filter((a) => a.status === "COMPLETED" || a.status === "DECLINED") },
  ];
  return (
    <>
      {header}
      {appts.length === 0 ? (
        <EmptyState icon={<Inbox className="size-5" />} title="No requests yet" description="Appointment requests from pet owners will appear here." />
      ) : (
        groups
          .filter((g) => g.items.length || g.title === "New requests")
          .map((g) => (
            <Section key={g.title} title={g.title} count={g.items.length}>
              {g.items.length === 0 ? (
                <p className="text-sm text-ink-500">Nothing new.</p>
              ) : (
                <ul className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
                  {g.items.map((a) => {
                    const st = APPOINTMENT_STATUS[a.status];
                    return (
                      <li key={a.id}>
                        <Link href={`/provider/appointments/${a.id}`} data-testid="request-row" className={rowClass}>
                          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sage-100 text-forest-800">
                            <SpeciesIcon species={a.pet.species} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold group-hover:text-forest-800">
                              {isVetService(a.service) ? SERVICE_LABEL[a.service] : a.service} · {a.pet.name}
                            </span>
                            <span className="tabular block truncate text-xs text-ink-500">
                              {slotLabel(a.slot)} · {a.owner.name}
                              {a.trip ? ` · ${routeTitle(a.trip)}` : ""}
                            </span>
                          </span>
                          {a._count.documents > 0 && (
                            <span className="hidden items-center gap-1 text-xs text-ink-500 sm:inline-flex">
                              <FileText className="size-3.5" /> {a._count.documents}
                            </span>
                          )}
                          <Badge tone={st?.tone ?? "neutral"} className={cn("hidden sm:inline-flex")}>
                            {st?.label ?? a.status}
                          </Badge>
                          <ArrowRight className="size-4 shrink-0 text-ink-400" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>
          ))
      )}
    </>
  );
}
