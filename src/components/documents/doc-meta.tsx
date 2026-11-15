import {
  CheckCircle2,
  CircleDot,
  FileBadge,
  FileCheck2,
  FileHeart,
  FileQuestion,
  FileText,
  FileWarning,
  Image as ImageIcon,
  Pill,
  ScanLine,
  Syringe,
} from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { DocType } from "@/lib/documents/extract";

export const DOC_STATUS: Record<string, { label: string; tone: BadgeTone; icon: React.ReactNode }> = {
  NEEDS_REVIEW: { label: "Needs review", tone: "warn", icon: <FileWarning className="size-3.5" /> },
  READY: { label: "Ready to confirm", tone: "info", icon: <CircleDot className="size-3.5" /> },
  CONFIRMED: { label: "Confirmed by you", tone: "ok", icon: <CheckCircle2 className="size-3.5" /> },
  STORED: { label: "Stored", tone: "neutral", icon: <FileText className="size-3.5" /> },
};

export function DocStatusBadge({ status }: { status: string }) {
  const s = DOC_STATUS[status] ?? DOC_STATUS.STORED;
  return (
    <Badge tone={s.tone} icon={s.icon}>
      {s.label}
    </Badge>
  );
}

const TYPE_ICON: Record<DocType, React.ElementType> = {
  RABIES: Syringe,
  MICROCHIP: ScanLine,
  AHC: FileBadge,
  TAPEWORM: Pill,
  CDC_RECEIPT: FileCheck2,
  OTHER: FileQuestion,
};

export function DocTypeIcon({ type, image, className }: { type: string; image?: boolean; className?: string }) {
  const Icon = image && type === "OTHER" ? ImageIcon : (TYPE_ICON[type as DocType] ?? FileHeart);
  return (
    <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl bg-sage-100 text-forest-800", className)}>
      <Icon className="size-5" aria-hidden />
    </span>
  );
}

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
