import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Circle,
  CalendarCheck,
  FileCheck2,
  FileUp,
  Plane,
  Stethoscope,
  HelpCircle,
  Info,
  Lightbulb,
  MapPinOff,
  PlaneLanding,
  PlaneTakeoff,
} from "lucide-react";
import { SpeciesIcon } from "@/components/pets/species-icon";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/feedback";
import { ProgressRing } from "@/components/ui/progress-ring";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/rules/dates";
import type { PlanTask, Rule, SupportedPlan } from "@/lib/rules/types";
import { openWindow, windowLabel } from "@/lib/trips/format";
import type { PetPlan } from "@/lib/trips/plan";
import { TASK_DOC_TYPE, type Evidence } from "@/lib/documents/links";
import { ownerStep, type StoredRecord } from "@/lib/trips/records";
import { OwnerStepControl } from "./step-control";
import { TripStatusBadge } from "./trip-status";

/** Present when the plan belongs to a saved trip, so owners can confirm their own steps. */
export type ChecklistContext = {
  tripId: string;
  today: string;
  records: StoredRecord[];
  /** The confirmed document behind each step, by task id */
  evidence?: Record<string, Evidence>;
  /** Who completed a step for the owner ("Recorded by …", "Booked with …"), by task id */
  recordedBy?: Record<string, string>;
  /** Live vet appointment for a step, by task id */
  appointments?: Record<string, { provider: string; when: string; status: string }>;
};

const TASK_ICON = {
  DONE: <CheckCircle2 className="size-5 text-forest-800" />,
  TODO: <Circle className="size-5 text-line-strong" />,
  VERIFY: <HelpCircle className="size-5 text-warn-700" />,
  BLOCKED: <AlertTriangle className="size-5 text-danger-700" />,
  INFO: <Lightbulb className="size-5 text-tan-600" />,
};

const TASK_STATUS_LABEL = {
  DONE: "Done",
  TODO: "To do",
  VERIFY: "Check this",
  BLOCKED: "Blocked",
  INFO: "Advice",
};

function TaskRow({
  task,
  rules,
  pet,
  context,
}: {
  task: PlanTask;
  rules: Map<string, Rule>;
  pet: { id: string; name: string };
  context?: ChecklistContext;
}) {
  const when = windowLabel(context ? openWindow(task.window, context.today) : task.window);
  const sources = task.ruleIds.map((id) => rules.get(id)).filter((r): r is Rule => !!r);
  const step = context ? ownerStep(task) : null;
  const record = step ? context?.records.find((r) => r.key === step.key) : undefined;
  const evidence = context?.evidence?.[task.id];
  const uploadType = context && !evidence && task.status !== "DONE" && task.status !== "INFO" && !task.abroad ? TASK_DOC_TYPE[task.id] : undefined;
  const recordedBy = context?.recordedBy?.[task.id];
  const appointment = context?.appointments?.[task.id];
  const findVet = context && task.service && !task.abroad && task.status === "TODO" && !appointment;
  return (
    <li
      id={`task-${pet.id}-${task.id}`}
      data-testid={`task-${task.id}`}
      data-status={task.status}
      className={cn(
        "flex scroll-mt-24 gap-4 border-b border-line px-5 py-4 last:border-b-0 target:bg-sage-50",
        task.status === "BLOCKED" && "bg-danger-100/40",
      )}
    >
      <span className="mt-0.5 shrink-0" aria-hidden>
        {TASK_ICON[task.status]}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <p className={cn("text-[15px] font-semibold", task.status === "DONE" && "text-ink-500")}>
            <span className="sr-only">{TASK_STATUS_LABEL[task.status]}: </span>
            {task.title}
          </p>
          {when && task.status !== "DONE" && (
            <span className="tabular shrink-0 rounded-full bg-cream-200 px-2.5 py-0.5 text-xs font-medium text-ink-700">
              {when}
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 empty:hidden">
          {evidence && (
            <Link
              href={`/app/documents/${evidence.id}`}
              data-testid="task-evidence"
              className="inline-flex h-6 max-w-full items-center gap-1.5 rounded-full bg-ok-100 px-2.5 text-xs font-medium text-ok-700 hover:underline"
            >
              <FileCheck2 className="size-3.5 shrink-0" />
              <span className="truncate">From {evidence.fileName}</span>
            </Link>
          )}
          {recordedBy && (
            <span data-testid="task-recorded-by" className="inline-flex h-6 items-center gap-1.5 rounded-full bg-ok-100 px-2.5 text-xs font-medium text-ok-700">
              {recordedBy.startsWith("Booked") ? <Plane className="size-3.5" /> : <Stethoscope className="size-3.5" />}
              {recordedBy}
            </span>
          )}
          {appointment && task.status !== "DONE" && (
            <Link
              href="/app/vets"
              data-testid="task-appointment"
              className="inline-flex h-6 items-center gap-1.5 rounded-full bg-info-100 px-2.5 text-xs font-medium text-info-700 hover:underline"
            >
              <CalendarCheck className="size-3.5" />
              {appointment.status === "ACCEPTED" ? "Booked" : "Requested"} · {appointment.provider} · {appointment.when}
            </Link>
          )}
          {findVet && (
            <Link
              href={`/app/vets?trip=${context.tripId}&pet=${pet.id}&task=${task.id}`}
              className="inline-flex h-6 items-center gap-1.5 rounded-full bg-forest-800 px-2.5 text-xs font-medium text-cream-50 hover:bg-forest-700"
            >
              <Stethoscope className="size-3.5" />
              Find a vet
            </Link>
          )}
          {step && context && (
            <OwnerStepControl
              tripId={context.tripId}
              pets={[pet]}
              taskId={task.id}
              taskTitle={task.title}
              done={task.status === "DONE"}
              record={record}
              step={step}
              today={context.today}
            />
          )}
        </div>
        <details className="group/more mt-1.5 text-sm [&_summary::-webkit-details-marker]:hidden" open={task.status === "VERIFY" || task.status === "BLOCKED"}>
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[13px] font-medium text-forest-800 hover:underline">
            <ChevronDown className="size-3.5 transition-transform group-open/more:rotate-180" />
            <span className="group-open/more:hidden">Details</span>
            <span className="hidden group-open/more:inline">Hide details</span>
          </summary>
        <p className="mt-1 text-sm leading-relaxed text-ink-700">{task.detail}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {task.status === "VERIFY" && <Badge tone="warn">Needs your input</Badge>}
          {task.officialVet && <Badge tone="brand">Official vet</Badge>}
          {task.abroad && <Badge tone="info">Done abroad</Badge>}
          {!task.blocking && <Badge tone="neutral">Advice</Badge>}
          {uploadType && (
            <Link
              href={`/app/documents/upload?pet=${pet.id}&type=${uploadType}`}
              className="inline-flex h-6 items-center gap-1.5 rounded-full border border-line-strong px-2.5 text-xs font-medium text-ink-700 hover:border-forest-700/40 hover:bg-sage-50"
            >
              <FileUp className="size-3.5" />
              {task.status === "VERIFY" ? "Upload the record" : "Upload when you have it"}
            </Link>
          )}
          {sources.length > 0 && (
            <details className="group/src w-full text-[13px] [&_summary::-webkit-details-marker]:hidden">
              <summary className="mt-1 inline-flex cursor-pointer list-none items-center gap-1 font-medium text-forest-800 hover:underline">
                <Info className="size-3.5" /> Why is this needed?
              </summary>
              <div className="mt-2 flex flex-col gap-3 rounded-control bg-cream-50 p-3">
                {sources.map((r) => (
                  <div key={r.id}>
                    <p className="font-medium text-ink-900">{r.title}</p>
                    <p className="mt-0.5 text-ink-700">{r.summary}</p>
                    <ul className="mt-1.5 flex flex-col gap-0.5">
                      {r.sources.map((s) => (
                        <li key={s.url}>
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-forest-800 underline-offset-4 hover:underline"
                          >
                            {s.name} <ArrowUpRight className="size-3" />
                            <span className="sr-only">(opens in a new tab)</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                    <p className="tabular mt-1 text-[11px] text-ink-400">
                      Last checked {formatDate(r.lastVerified)}
                      {r.reviewStatus === "NEEDS_REVIEW" ? " · needs review" : ""}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
        </details>
      </div>
    </li>
  );
}

function Leg({
  title,
  icon,
  tasks,
  rules,
  testId,
  pet,
  context,
}: {
  title: string;
  icon: React.ReactNode;
  tasks: PlanTask[];
  rules: Map<string, Rule>;
  testId: string;
  pet: { id: string; name: string };
  context?: ChecklistContext;
}) {
  if (!tasks.length) return null;
  return (
    <section aria-label={title} data-testid={testId}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-ink-500">
        {icon} {title}
      </h3>
      <ol className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} rules={rules} pet={pet} context={context} />
        ))}
      </ol>
    </section>
  );
}

function Summary({ plan, name }: { plan: SupportedPlan; name: string }) {
  if (plan.status === "NOT_FEASIBLE") {
    const earliest = plan.earliestFeasibleArrival ?? plan.earliestFeasibleReturn;
    return (
      <Callout tone="danger" icon={<AlertTriangle className="size-4.5" />} title={`${name} isn't ready for these dates`}>
        <ul className="mt-1 flex flex-col gap-1">
          {plan.blockers.map((b) => (
            <li key={`${b.code}-${b.taskId}`}>{b.message}</li>
          ))}
        </ul>
        {earliest ? (
          <p className="mt-2 font-medium text-ink-900">
            Earliest {plan.earliestFeasibleArrival ? "arrival" : "return"} that works:{" "}
            <span className="tabular">{formatDate(earliest)}</span>
          </p>
        ) : (
          <p className="mt-2 font-medium text-ink-900">Changing the date won&apos;t fix this.</p>
        )}
      </Callout>
    );
  }
  if (plan.status === "NEEDS_INFO") {
    const n = plan.tasks.filter((t) => t.status === "VERIFY").length;
    return (
      <Callout tone="warn" icon={<HelpCircle className="size-4.5" />} title={`We need ${n} more answer${n === 1 ? "" : "s"} about ${name}`}>
        Until then those steps aren&apos;t treated as done.
      </Callout>
    );
  }
  if (plan.status === "READY") {
    return (
      <Callout tone="ok" icon={<CheckCircle2 className="size-4.5" />} title={`${name} is ready to travel`}>
        Every required step is done.
      </Callout>
    );
  }
  return null;
}

export function PetPlanSection({
  entry,
  rules,
  context,
}: {
  entry: PetPlan;
  rules: Map<string, Rule>;
  context?: ChecklistContext;
}) {
  const { pet, plan } = entry;
  if (!plan.supported) {
    return (
      <section data-testid={`plan-${pet.name}`} className="flex flex-col gap-4">
        <header className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-tan-100 text-tan-700">
            <SpeciesIcon species={pet.species} />
          </span>
          <h2 className="text-xl font-semibold">{pet.name}</h2>
          <TripStatusBadge status="UNSUPPORTED" />
        </header>
        <Callout tone="warn" icon={<MapPinOff className="size-4.5" />} title="We can't plan this trip for this pet">
          {plan.reasons.map((r) => (
            <p key={r.code}>{r.message}</p>
          ))}
        </Callout>
      </section>
    );
  }
  const required = plan.tasks.filter((t) => t.blocking);
  const done = required.filter((t) => t.status === "DONE").length;
  const ruleMap = new Map([...rules, ...plan.rules.map((r) => [r.id, r] as const)]);

  return (
    <section data-testid={`plan-${pet.name}`} className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center gap-4">
        <ProgressRing value={done} max={required.length || 1} size={64} stroke={6} label={`${pet.name} readiness`}>
          <span className="tabular text-sm font-semibold">
            {done}/{required.length}
          </span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <SpeciesIcon species={pet.species} className="size-5 text-tan-600" />
            {pet.name}
          </h2>
          <p className="text-sm text-ink-500">
            {done} of {required.length} required steps done
          </p>
        </div>
        <TripStatusBadge status={plan.status} />
      </header>
      <Summary plan={plan} name={pet.name} />
      {plan.warnings.length > 0 && (
        <ul className="flex flex-col gap-1.5 rounded-control border border-line bg-cream-50 p-4 text-[13px] text-ink-700">
          {plan.warnings.map((w) => (
            <li key={w} className="flex gap-2">
              <Info className="mt-0.5 size-3.5 shrink-0 text-info-700" /> {w}
            </li>
          ))}
        </ul>
      )}
      <Leg
        title="Before you go"
        icon={<PlaneTakeoff className="size-4" />}
        tasks={plan.tasks.filter((t) => t.leg === "OUTBOUND")}
        rules={ruleMap}
        testId={`leg-outbound-${pet.name}`}
        pet={pet}
        context={context}
      />
      <Leg
        title="Coming home"
        icon={<PlaneLanding className="size-4" />}
        tasks={plan.tasks.filter((t) => t.leg === "RETURN")}
        rules={ruleMap}
        testId={`leg-return-${pet.name}`}
        pet={pet}
        context={context}
      />
    </section>
  );
}
