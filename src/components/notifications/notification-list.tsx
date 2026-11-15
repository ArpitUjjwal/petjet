import {
  AlarmClock,
  ArrowRight,
  Bell,
  CalendarCheck,
  CalendarX,
  FileSignature,
  FlaskConical,
  Inbox,
  Plane,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import type { DeadlineReminder } from "@/lib/notifications/deadlines";
import { MarkAllReadButton } from "./mark-all-read";

/* The notifications page for owners, vets and labs: deadline reminders first, then events. */

export type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
};

const ICON: Record<string, LucideIcon> = {
  APPOINTMENT_REQUESTED: Inbox,
  APPOINTMENT_ACCEPTED: CalendarCheck,
  APPOINTMENT_DECLINED: CalendarX,
  VET_RECORDED: FileSignature,
  LAB_ORDERED: FlaskConical,
  LAB_RESULT: FlaskConical,
  FLIGHT_BOOKED: Plane,
};

function when(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(d);
}

const rowClass = "flex items-start gap-3.5 border-b border-line px-4 py-3.5 last:border-b-0 sm:px-5";

function Row({
  icon: Icon,
  title,
  body,
  meta,
  href,
  unread,
  tone,
  testId,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  meta?: React.ReactNode;
  href: string | null;
  unread?: boolean;
  tone: "brand" | "warn" | "danger";
  testId: string;
}) {
  const inner = (
    <>
      <span
        className={cn(
          "mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl",
          tone === "brand" && "bg-sage-100 text-forest-800",
          tone === "warn" && "bg-warn-100 text-warn-700",
          tone === "danger" && "bg-danger-100 text-danger-700",
        )}
      >
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm", unread ? "font-semibold text-ink-900" : "font-medium text-ink-700")}>{title}</span>
        <span className="mt-0.5 block text-sm text-ink-500">{body}</span>
        {meta && <span className="tabular mt-1 block text-xs text-ink-400">{meta}</span>}
      </span>
      {unread && <span aria-label="Unread" className="mt-2 size-2 shrink-0 rounded-full bg-tan-500" />}
      {href && <ArrowRight aria-hidden className="mt-2 size-4 shrink-0 text-ink-400" />}
    </>
  );
  return (
    <li data-testid={testId} data-unread={unread ? "true" : undefined}>
      {href ? (
        <Link href={href} className={cn(rowClass, "transition-colors hover:bg-cream-50")}>
          {inner}
        </Link>
      ) : (
        <div className={rowClass}>{inner}</div>
      )}
    </li>
  );
}

const listClass = "overflow-hidden rounded-card border border-line bg-surface shadow-card";
const headingClass = "mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-500";

export function NotificationList({
  items,
  reminders = [],
  emptyText = "Updates from vets, labs and bookings, and reminders about deadlines, will show here.",
}: {
  items: NotificationRow[];
  reminders?: DeadlineReminder[];
  emptyText?: string;
}) {
  const unread = items.filter((n) => !n.readAt).length;
  if (!items.length && !reminders.length) {
    return (
      <EmptyState
        icon={<Bell className="size-5" />}
        title="Nothing new"
        description={emptyText}
      />
    );
  }
  return (
    <div className="flex flex-col gap-8">
      {reminders.length > 0 && (
        <section aria-label="Deadlines">
          <h2 className={headingClass}>Deadlines this week</h2>
          <ul className={listClass}>
            {reminders.map((r) => (
              <Row
                key={r.id}
                testId="reminder"
                icon={AlarmClock}
                tone={r.overdue ? "danger" : "warn"}
                title={r.title}
                body={r.body}
                meta={r.tripTitle}
                href={r.href}
              />
            ))}
          </ul>
        </section>
      )}
      {items.length > 0 && (
        <section aria-label="Updates">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className={cn(headingClass, "mb-0 flex items-center gap-2")}>
              Updates
              {unread > 0 && <Badge tone="brand">{unread} new</Badge>}
            </h2>
            {unread > 0 && <MarkAllReadButton />}
          </div>
          <ul className={listClass}>
            {items.map((n) => (
              <Row
                key={n.id}
                testId="notification"
                icon={ICON[n.kind] ?? Bell}
                tone="brand"
                title={n.title}
                body={n.body}
                meta={when(n.createdAt)}
                href={n.href}
                unread={!n.readAt}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
