import { AlertTriangle, CheckCircle2, CircleDashed, HelpCircle, MapPinOff } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { TripStatus } from "@/lib/trips/plan";

export const STATUS: Record<TripStatus, { label: string; tone: BadgeTone; icon: React.ReactNode }> = {
  READY: { label: "Ready to travel", tone: "ok", icon: <CheckCircle2 className="size-3.5" /> },
  IN_PROGRESS: { label: "In progress", tone: "info", icon: <CircleDashed className="size-3.5" /> },
  NEEDS_INFO: { label: "Needs your input", tone: "warn", icon: <HelpCircle className="size-3.5" /> },
  NOT_FEASIBLE: { label: "Not ready for this date", tone: "danger", icon: <AlertTriangle className="size-3.5" /> },
  UNSUPPORTED: { label: "Not supported", tone: "neutral", icon: <MapPinOff className="size-3.5" /> },
};

export function TripStatusBadge({ status }: { status: TripStatus }) {
  const s = STATUS[status];
  return (
    <Badge tone={s.tone} icon={s.icon}>
      {s.label}
    </Badge>
  );
}
