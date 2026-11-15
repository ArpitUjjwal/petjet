import { HelpCircle } from "lucide-react";
import Link from "next/link";
import { toTimelineItem } from "@/components/dashboard/bento";
import { Timeline } from "@/components/ui/timeline";
import { petNames } from "@/lib/trips/dashboard";
import { groupByMonth, type TripTimeline } from "@/lib/trips/timeline";

/** The full plan as a dated timeline, grouped by month. */
export function TripTimelineView({
  timeline,
  tripId,
  showPets,
  today,
}: {
  timeline: TripTimeline;
  tripId: string;
  showPets: boolean;
  today: string;
}) {
  const groups = groupByMonth(timeline.entries);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]" data-testid="trip-timeline">
      <div className="flex flex-col gap-6">
        {groups.map((g) => (
          <section
            key={g.key}
            aria-label={g.label}
            className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6"
          >
            <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-wider text-ink-500">{g.label}</h2>
            <Timeline items={g.entries.map((e) => toTimelineItem(e, { showPets, today }))} />
          </section>
        ))}
      </div>
      <aside className="flex flex-col gap-4">
        <div className="rounded-card border border-line bg-cream-50 p-5">
          <p className="tabular text-3xl font-semibold tracking-tight">{timeline.doneCount}</p>
          <p className="text-sm text-ink-500">step{timeline.doneCount === 1 ? "" : "s"} already done</p>
          <Link href={`/app/trips/${tripId}`} className="mt-3 inline-block text-[13px] font-medium text-forest-800 hover:underline">
            See them in the checklist
          </Link>
        </div>
        {timeline.undated.length > 0 && (
          <div className="rounded-card border border-warn-700/15 bg-warn-100 p-5" data-testid="timeline-undated">
            <p className="flex items-center gap-2 text-sm font-semibold text-warn-700">
              <HelpCircle className="size-4" /> No date yet
            </p>
            <p className="mt-1 text-[13px] text-ink-700">We need your answers before these steps can be dated:</p>
            <ul className="mt-2 flex flex-col gap-1 text-[13px] font-medium text-ink-900">
              {timeline.undated.map((m) => (
                <li key={m.key}>
                  {m.task.title}
                  {showPets ? <span className="font-normal text-ink-500"> · {petNames(m.pets)}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
