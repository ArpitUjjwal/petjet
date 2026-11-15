import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  FileSearch,
  CheckCircle2,
  Clock,
  HelpCircle,
  Home,
  Info,
  MapPinOff,
  PartyPopper,
  Plane,
} from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { SpeciesIcon } from "@/components/pets/species-icon";
import { OwnerStepControl } from "@/components/trips/step-control";
import { EditDatesButton } from "@/components/trips/trip-editor";
import { STATUS, TripStatusBadge } from "@/components/trips/trip-status";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Timeline, type TimelineItem } from "@/components/ui/timeline";
import { cn } from "@/lib/cn";
import { diffDays, formatDate, formatShortDate, type ISODate } from "@/lib/rules/dates";
import type { AttentionItem, Countdown, MergedTask, Readiness } from "@/lib/trips/dashboard";
import { petNames } from "@/lib/trips/dashboard";
import { openWindow, windowLabel } from "@/lib/trips/format";
import { countryLabel } from "@/lib/trips/options";
import type { TripStatus } from "@/lib/trips/plan";
import { ownerStep, type StoredRecord } from "@/lib/trips/records";
import type { TimelineEntry } from "@/lib/trips/timeline";

/* The owner dashboard's bento tiles. Server components; interactive parts are client islands. */

function Tile({
  children,
  className,
  index = 0,
  testId,
  label,
}: {
  children: ReactNode;
  className?: string;
  index?: number;
  testId?: string;
  label?: string;
}) {
  return (
    <section
      aria-label={label}
      data-testid={testId}
      style={{ animationDelay: `${index * 70}ms` } as CSSProperties}
      className={cn("animate-rise rounded-card border border-line bg-surface p-5 shadow-card sm:p-6", className)}
    >
      {children}
    </section>
  );
}

function TileTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-500">{children}</h2>
      {action}
    </div>
  );
}

/* ---------- Hero: route, countdown, runway ---------- */

type HeroTrip = {
  id: string;
  origin: string;
  destination: string;
  arrivalDate: ISODate;
  returnDate: ISODate | null;
  departureAirport: string | null;
  arrivalAirport: string | null;
  pets: { id: string; name: string; species: string }[];
};

function pct(d: ISODate, start: ISODate, end: ISODate) {
  const span = Math.max(diffDays(end, start), 1);
  return Math.min(100, Math.max(0, (diffDays(d, start) / span) * 100));
}

/** A track from today to the end of the trip with every open deadline marked on it. */
function Runway({ trip, today, deadlines }: { trip: HeroTrip; today: ISODate; deadlines: ISODate[] }) {
  const start = today < trip.arrivalDate ? today : trip.arrivalDate;
  const end = trip.returnDate ?? trip.arrivalDate;
  if (diffDays(end, start) <= 0) return null;
  const arrival = pct(trip.arrivalDate, start, end);
  const ticks = [...new Set(deadlines)].filter((d) => d >= start && d <= end);
  return (
    <div className="mt-6" data-testid="runway">
      <div className="relative h-1.5 rounded-full bg-forest-700">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sage-300/70 to-tan-500"
          style={{ width: `${arrival}%` }}
        />
        {ticks.map((d) => (
          <span
            key={d}
            title={`Deadline ${formatDate(d)}`}
            className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-forest-800 bg-cream-50"
            style={{ left: `${pct(d, start, end)}%` }}
          />
        ))}
        <span
          className="absolute top-1/2 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-tan-500 text-forest-950 shadow-raised"
          style={{ left: `${arrival}%` }}
        >
          <Plane className="size-3.5" />
        </span>
        {trip.returnDate && (
          <span className="absolute right-0 top-1/2 grid size-6 -translate-y-1/2 translate-x-1/2 place-items-center rounded-full bg-cream-50 text-forest-800">
            <Home className="size-3.5" />
          </span>
        )}
      </div>
      <div className="tabular mt-3 flex justify-between gap-2 text-[11px] font-medium text-sage-300">
        <span>Today · {formatShortDate(today)}</span>
        <span>
          {ticks.length} deadline{ticks.length === 1 ? "" : "s"} ahead
        </span>
        <span>{trip.returnDate ? `Home · ${formatShortDate(trip.returnDate)}` : `Arrive · ${formatShortDate(trip.arrivalDate)}`}</span>
      </div>
    </div>
  );
}

export function HeroTile({
  trip,
  status,
  count,
  today,
  deadlines,
  ready,
  className,
}: {
  trip: HeroTrip;
  status: TripStatus;
  count: Countdown;
  today: ISODate;
  deadlines: ISODate[];
  /** When given, a slim readiness bar replaces the runway (the simple Home) */
  ready?: Readiness;
  className?: string;
}) {
  return (
    <section
      data-testid="tile-hero"
      aria-label="Trip overview"
      className={cn(
        "animate-rise relative overflow-hidden rounded-card bg-forest-800 p-6 text-cream-50 shadow-raised sm:p-7",
        className ?? "lg:col-span-4",
      )}
    >
      <Plane aria-hidden className="absolute -right-10 -top-10 size-56 -rotate-12 text-forest-700/70" strokeWidth={0.75} />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow text-sage-300">{count.phase === "done" ? "Past trip" : "Your trip"}</p>
        <span className="inline-flex rounded-full bg-cream-50 p-0.5" data-testid="trip-status">
          <TripStatusBadge status={status} />
        </span>
      </div>

      <div className="relative mt-5 flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="tabular font-mono text-3xl font-semibold tracking-tight sm:text-4xl">{trip.origin}</span>
            <span aria-hidden className="flex w-16 items-center gap-1 sm:w-24">
              <span className="h-px flex-1 border-t border-dashed border-sage-400" />
              <Plane className="size-4 text-tan-500" />
              <span className="h-px flex-1 border-t border-dashed border-sage-400" />
            </span>
            <span className="tabular font-mono text-3xl font-semibold tracking-tight text-tan-200 sm:text-4xl">
              {trip.destination}
            </span>
          </div>
          <h2 className="mt-2 text-xl font-semibold sm:text-2xl">
            {countryLabel(trip.origin)} to {countryLabel(trip.destination)}
          </h2>
          <p className="tabular mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-sage-200">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" /> Arrives {formatDate(trip.arrivalDate)}
            </span>
            <span>{trip.returnDate ? `Home ${formatDate(trip.returnDate)}` : "Return date not set"}</span>
            {(trip.departureAirport || trip.arrivalAirport) && (
              <span>{[trip.departureAirport, trip.arrivalAirport].filter(Boolean).join(" → ")}</span>
            )}
          </p>
          <p className="mt-3 flex flex-wrap gap-2">
            {trip.pets.map((p) => (
              <Link
                key={p.id}
                href={`/app/pets/${p.id}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-forest-700 px-2.5 py-1 text-xs font-medium text-cream-50 hover:bg-forest-600"
              >
                <SpeciesIcon species={p.species} className="size-3.5 text-tan-200" />
                {p.name}
              </Link>
            ))}
          </p>
        </div>
        <div className="text-right" data-testid="countdown">
          <p className="tabular text-6xl font-semibold leading-none tracking-tighter sm:text-7xl">
            {count.phase === "travel-day" ? <Plane className="ml-auto size-14" aria-hidden /> : count.days}
          </p>
          <p className="mt-1.5 text-sm text-sage-300">{count.label}</p>
        </div>
      </div>

      {ready ? (
        <div className="relative mt-6" data-testid="readiness">
          <div className="flex items-center justify-between text-xs text-sage-200">
            <span>Trip readiness</span>
            <span className="tabular" data-testid="readiness-count">
              {ready.done} of {ready.total} steps
            </span>
          </div>
          <div
            className="mt-1.5 h-2 overflow-hidden rounded-full bg-forest-700"
            role="progressbar"
            aria-label="Trip readiness"
            aria-valuemin={0}
            aria-valuemax={ready.total}
            aria-valuenow={ready.done}
          >
            <div className="h-full rounded-full bg-tan-500 transition-[width] duration-700" style={{ width: `${ready.pct}%` }} />
          </div>
        </div>
      ) : (
        <>
          <Runway trip={trip} today={today} deadlines={deadlines} />
          <div className="relative mt-6 flex flex-wrap gap-2.5">
            <ButtonLink href={`/app/trips/${trip.id}`} variant="accent" iconRight={<ArrowRight className="size-4" />}>
              Open checklist
            </ButtonLink>
            <EditDatesButton />
          </div>
        </>
      )}
    </section>
  );
}

/* ---------- Readiness ---------- */

export function ReadinessTile({ data, index }: { data: Readiness; index: number }) {
  return (
    <Tile index={index} testId="tile-readiness" label="Readiness" className="flex flex-col lg:col-span-2">
      <TileTitle>Readiness</TileTitle>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-2">
        <ProgressRing value={data.done} max={data.total || 1} size={148} stroke={12} label="Trip readiness">
          <span className="flex flex-col items-center">
            <span className="tabular text-3xl font-semibold tracking-tight">{data.pct}%</span>
            <span className="tabular text-xs text-ink-500" data-testid="readiness-count">
              {data.done} of {data.total} steps
            </span>
          </span>
        </ProgressRing>
      </div>
      {data.perPet.length > 1 && (
        <ul className="mt-4 flex flex-col gap-2.5 border-t border-line pt-4">
          {data.perPet.map((p) => (
            <li key={p.id} className="flex items-center gap-3 text-[13px]">
              <span className="w-20 truncate font-medium">{p.name}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sage-100">
                <span
                  className="block h-full rounded-full bg-forest-800 transition-[width] duration-700 ease-out-soft"
                  style={{ width: `${p.total ? (p.done / p.total) * 100 : 0}%` }}
                />
              </span>
              <span className="tabular w-10 text-right text-ink-500">
                {p.done}/{p.total}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Tile>
  );
}

/* ---------- Next step ---------- */

function dueLabel(m: MergedTask) {
  if (m.daysLeft === undefined) return null;
  if (m.daysLeft < 0) return { text: `Overdue since ${formatDate(m.due!)}`, tone: "danger" as const };
  if (m.daysLeft === 0) return { text: "Due today", tone: "danger" as const };
  return {
    text: `Due in ${m.daysLeft} day${m.daysLeft === 1 ? "" : "s"}`,
    tone: m.daysLeft <= 14 ? ("warn" as const) : ("neutral" as const),
  };
}

export function NextStepTile({
  next,
  then = [],
  status,
  tripId,
  today,
  records,
  index,
}: {
  next: MergedTask | null;
  /** The steps after this one, shown as a short "then" list */
  then?: MergedTask[];
  status: TripStatus;
  tripId: string;
  today: ISODate;
  records: (StoredRecord & { petId: string })[];
  index: number;
}) {
  if (!next) {
    const ready = status === "READY";
    return (
      <Tile index={index} testId="tile-next" label="Next step" className="lg:col-span-3">
        <TileTitle>Next step</TileTitle>
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-2xl",
              ready ? "bg-ok-100 text-ok-700" : "bg-danger-100 text-danger-700",
            )}
          >
            {ready ? <PartyPopper className="size-5" /> : <AlertTriangle className="size-5" />}
          </span>
          <div>
            <p className="text-lg font-semibold">{ready ? "Every required step is done" : "Sort out your dates first"}</p>
            <p className="mt-1 text-sm text-ink-500">
              {ready
                ? "Keep your documents together for the journey. We'll remind you if anything changes."
                : "Some steps can't be done in time for these dates. Change them to unlock the plan."}
            </p>
          </div>
        </div>
      </Tile>
    );
  }
  const { task } = next;
  const due = dueLabel(next);
  const step = ownerStep(task);
  const window = windowLabel(openWindow(task.window, today));
  return (
    <Tile index={index} testId="tile-next" label="Next step" className="flex flex-col lg:col-span-3">
      <TileTitle action={due && <Badge tone={due.tone} icon={<Clock className="size-3.5" />}>{due.text}</Badge>}>
        Next step
      </TileTitle>
      <p className="text-xl font-semibold tracking-tight" data-testid="next-title">
        {task.title}
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-500">
        <span>For {petNames(next.pets)}</span>
        {window && <span className="tabular">{window}</span>}
        {task.officialVet && <Badge tone="brand">Official vet</Badge>}
        {task.status === "VERIFY" && <Badge tone="warn">Needs your input</Badge>}
      </p>
      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-ink-700">{task.detail}</p>
      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        {step && (
          <OwnerStepControl
            tripId={tripId}
            pets={next.pets}
            taskId={task.id}
            taskTitle={task.title}
            done={false}
            record={records.find((r) => r.petId === next.pets[0].id && r.key === step.key)}
            step={step}
            today={today}
            size="md"
          />
        )}
        <ButtonLink
          href={`/app/trips/${tripId}#task-${next.pets[0].id}-${task.id}`}
          variant={step ? "ghost" : "primary"}
          iconRight={<ArrowRight className="size-4" />}
        >
          {task.service ? "See what's involved" : "Open in checklist"}
        </ButtonLink>
      </div>
      {then.length > 0 && (
        <div className="mt-auto pt-6">
          <p className="border-t border-line pt-4 text-[12px] font-semibold uppercase tracking-wider text-ink-400">
            Then
          </p>
          <ol className="mt-2 flex flex-col" data-testid="then-list">
            {then.map((m) => (
              <li key={m.key} className="flex items-baseline justify-between gap-3 py-1.5 text-[13px]">
                <span className="min-w-0 truncate font-medium text-ink-900">
                  {m.task.title}
                  {next.pets.length > 1 || m.pets.length > 1 ? (
                    <span className="font-normal text-ink-500"> · {petNames(m.pets)}</span>
                  ) : null}
                </span>
                <span className="tabular shrink-0 text-ink-500">
                  {m.due ? formatShortDate(m.due) : "No date yet"}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Tile>
  );
}

/* ---------- Needs attention ---------- */

const ATTENTION_ICON = {
  conflict: <AlertTriangle className="size-4" />,
  unsupported: <MapPinOff className="size-4" />,
  overdue: <AlertTriangle className="size-4" />,
  "due-soon": <Clock className="size-4" />,
  verify: <HelpCircle className="size-4" />,
  documents: <FileSearch className="size-4" />,
  note: <Info className="size-4" />,
};

const ATTENTION_TONE = {
  danger: "bg-danger-100 text-danger-700",
  warn: "bg-warn-100 text-warn-700",
  info: "bg-info-100 text-info-700",
};

export function AttentionTile({
  items,
  tripId,
  firstPetId,
  index,
}: {
  items: AttentionItem[];
  tripId: string;
  firstPetId?: string;
  index: number;
}) {
  const urgent = items.filter((i) => i.kind !== "note").length;
  /* Keep the tile compact: the three most pressing items, the rest on request, notes last */
  const pressing = items.filter((i) => i.kind !== "note");
  const notes = items.filter((i) => i.kind === "note");
  const shown = [...pressing.slice(0, 3), ...(pressing.length <= 3 ? notes : [])];
  const rest = pressing.length > 3 ? [...pressing.slice(3), ...notes] : [];
  const renderItem = (item: AttentionItem) => (
          <li
      key={item.id}
      data-testid={`attention-${item.kind}`}
      className={cn(
        "flex gap-3 rounded-control border p-3.5",
        item.kind === "conflict" ? "border-danger-700/20 bg-danger-100/50" : "border-line",
      )}
    >
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", ATTENTION_TONE[item.tone])}>
        {ATTENTION_ICON[item.kind]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{item.title}</p>
        {item.kind === "note" ? (
          <details className="mt-1 text-[13px] text-ink-700 [&_summary::-webkit-details-marker]:hidden">
            <summary className="cursor-pointer list-none font-medium text-forest-800 hover:underline">
              {item.lines.length} note{item.lines.length === 1 ? "" : "s"} about your plan
            </summary>
            <ul className="mt-1.5 flex flex-col gap-1">
              {item.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </details>
        ) : (
          <ul className="mt-0.5 flex flex-col gap-0.5 text-[13px] text-ink-700">
            {item.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
        {item.kind === "conflict" && (
          <div className="mt-3 flex flex-wrap gap-2">
            {item.suggestion ? (
              <EditDatesButton size="sm" variant="primary" prefill={item.suggestion}>
                Move to {formatDate(item.suggestion.arrivalDate)}
              </EditDatesButton>
            ) : (
              <p className="text-[13px] font-medium text-ink-900">Changing the date won&apos;t fix this.</p>
            )}
            {item.suggestion && (
              <EditDatesButton size="sm" variant="ghost">
                Pick other dates
              </EditDatesButton>
            )}
          </div>
        )}
        {item.taskId && firstPetId && item.kind !== "conflict" && (
          <Link
            href={`/app/trips/${tripId}#task-${firstPetId}-${item.taskId}`}
            className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-medium text-forest-800 hover:underline"
          >
            View step <ArrowUpRight className="size-3" />
          </Link>
        )}
      </div>
    </li>
  );
  return (
    <Tile index={index} testId="tile-attention" label="Needs attention" className="lg:col-span-3">
      <TileTitle
        action={urgent > 0 ? <Badge tone="danger">{urgent}</Badge> : undefined}
      >
        Needs attention
      </TileTitle>
      {urgent === 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-control bg-ok-100 p-3 text-sm text-ok-700">
          <CheckCircle2 className="size-5 shrink-0" />
          <span>Nothing urgent. Your dates work and nothing is due in the next two weeks.</span>
        </div>
      )}
      <ul className="flex flex-col gap-3">{shown.map(renderItem)}</ul>
      {rest.length > 0 && (
        <details className="group mt-3 [&_summary::-webkit-details-marker]:hidden">
          <summary className="cursor-pointer list-none text-[13px] font-medium text-forest-800 hover:underline">
            <span className="group-open:hidden">Show {rest.length} more</span>
            <span className="hidden group-open:inline">Show fewer</span>
          </summary>
          <ul className="mt-3 flex flex-col gap-3">{rest.map(renderItem)}</ul>
        </details>
      )}
    </Tile>
  );
}

/* ---------- Timeline preview ---------- */

export function toTimelineItem(e: TimelineEntry, opts: { showPets: boolean; today: ISODate }): TimelineItem {
  const state: TimelineItem["state"] =
    e.state === "overdue" ? "blocked" : e.state === "today" ? "today" : e.state;
  const when = e.kind === "task" ? windowLabel(openWindow(e.window, opts.today)) : formatDate(e.date);
  const pets = opts.showPets && e.kind === "task" ? petNames(e.pets) : "";
  return {
    id: e.id,
    date: e.kind === "today" ? formatDate(e.date) : (when ?? formatDate(e.date)),
    title: e.title,
    state,
    detail:
      [pets, e.state === "overdue" ? "Overdue" : "", e.state === "advice" ? "Advice" : "", e.state === "next" ? "Up next" : ""]
        .filter(Boolean)
        .join(" · ") || undefined,
  };
}

export function TimelineTile({
  entries,
  tripId,
  showPets,
  today,
  index,
}: {
  entries: TimelineEntry[];
  tripId: string;
  showPets: boolean;
  today: ISODate;
  index: number;
}) {
  const start = Math.max(0, entries.findIndex((e) => e.kind === "today"));
  const upcoming = entries.slice(start, start + 6);
  return (
    <Tile index={index} testId="tile-timeline" label="Timeline" className="lg:col-span-4">
      <TileTitle
        action={
          <Link
            href={`/app/trips/${tripId}?view=timeline`}
            className="inline-flex items-center gap-1 text-[13px] font-medium text-forest-800 hover:underline"
          >
            Full timeline <ArrowRight className="size-3.5" />
          </Link>
        }
      >
        Coming up
      </TileTitle>
      <Timeline items={upcoming.map((e) => toTimelineItem(e, { showPets, today }))} />
    </Tile>
  );
}

/* ---------- Pets on this trip ---------- */

export function PetsTile({
  pets,
  index,
}: {
  pets: { id: string; name: string; species: string; breed: string | null; status: TripStatus; done: number; total: number }[];
  index: number;
}) {
  return (
    <Tile index={index} testId="tile-pets" label="Travelling" className="flex flex-col lg:col-span-2">
      <TileTitle
        action={
          <Link href="/app/pets" className="text-[13px] font-medium text-forest-800 hover:underline">
            My pets
          </Link>
        }
      >
        Travelling
      </TileTitle>
      <ul className="flex flex-col gap-2.5">
        {pets.map((p) => (
          <li key={p.id}>
            <Link
              href={`/app/pets/${p.id}`}
              className="group flex items-center gap-3 rounded-control border border-line p-3 transition-colors hover:border-line-strong hover:bg-cream-50"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-tan-100 text-tan-700">
                <SpeciesIcon species={p.species} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold group-hover:text-forest-800">{p.name}</span>
                <span className="tabular block truncate text-xs text-ink-500">
                  {p.breed ? `${p.breed} · ` : ""}
                  {p.total ? `${p.done}/${p.total} steps` : "Not planned"}
                </span>
              </span>
              <span className="sr-only">{STATUS[p.status].label}</span>
              <span
                aria-hidden
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full",
                  {
                    ok: "bg-ok-100 text-ok-700",
                    info: "bg-info-100 text-info-700",
                    warn: "bg-warn-100 text-warn-700",
                    danger: "bg-danger-100 text-danger-700",
                    neutral: "bg-cream-200 text-ink-500",
                    brand: "bg-sage-200 text-forest-800",
                    sample: "bg-cream-200 text-ink-500",
                  }[STATUS[p.status].tone],
                )}
              >
                {STATUS[p.status].icon}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Tile>
  );
}

/* ---------- Flights ---------- */

export function FlightsTile({
  tripId,
  bookings,
  index,
}: {
  tripId: string;
  bookings: { id: string; leg: string; airlineName: string; logo?: string; flightNumber: string; from: string; to: string; date: string; depart: string; arrive: string }[];
  index: number;
}) {
  return (
    <Tile index={index} testId="tile-flights" label="Flights" className="lg:col-span-6">
      <TileTitle
        action={
          <Link href={`/app/flights?trip=${tripId}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-forest-800 hover:underline">
            {bookings.length ? "Manage flights" : "Find flights"} <ArrowRight className="size-3.5" />
          </Link>
        }
      >
        Flights
      </TileTitle>
      {bookings.length === 0 ? (
        <p className="text-sm text-ink-500">No flights booked yet. We&apos;ll show which flights your pets can take, and where they&apos;d travel.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {bookings.map((b) => (
            <li key={b.id}>
              <Link
                href={`/app/flights/${b.id}`}
                data-testid="dashboard-booking"
                className="group flex items-center gap-4 rounded-control border border-line p-3.5 transition-colors hover:border-line-strong hover:bg-cream-50"
              >
                <span className="grid h-9 w-24 shrink-0 place-items-center rounded-lg bg-white ring-1 ring-line">
                  {b.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.logo} alt={b.airlineName} className="h-3.5 w-auto max-w-[80px] object-contain" />
                  ) : (
                    <Plane className="size-4" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="tabular block text-sm font-semibold group-hover:text-forest-800">
                    {b.from} {b.depart} → {b.to} {b.arrive}
                  </span>
                  <span className="tabular block text-xs text-ink-500">
                    {b.leg === "OUTBOUND" ? "Out" : "Home"} · {formatDate(b.date)} · {b.flightNumber}
                  </span>
                </span>
                <span className="text-xs font-medium text-forest-800">Boarding pass</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Tile>
  );
}
