import {
  AlertTriangle,
  Check,
  FileText,
  MapPin,
  MessageCircle,
  Plane,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { Reveal, SectionHeading } from "./reveal";

function Tile({
  icon,
  title,
  body,
  children,
  className,
  delay = 0,
  dark = false,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  children?: ReactNode;
  className?: string;
  delay?: number;
  dark?: boolean;
}) {
  return (
    <Reveal delay={delay} className={className}>
      <article
        className={cn(
          "group flex h-full flex-col overflow-hidden rounded-card p-6 transition-[box-shadow,transform] duration-300 ease-out-soft hover:-translate-y-0.5",
          dark
            ? "bg-forest-800 text-cream-50 shadow-raised hover:shadow-float"
            : "border border-line bg-surface shadow-card hover:shadow-raised",
        )}
      >
        <span
          className={cn(
            "grid size-10 place-items-center rounded-xl",
            dark ? "bg-forest-700 text-tan-500" : "bg-sage-100 text-forest-800",
          )}
        >
          {icon}
        </span>
        <h3 className="mt-5 text-lg font-semibold">{title}</h3>
        <p className={cn("mt-1.5 text-[15px] leading-relaxed", dark ? "text-sage-200" : "text-ink-500")}>
          {body}
        </p>
        {children && <div className="mt-6 flex-1">{children}</div>}
      </article>
    </Reveal>
  );
}

function MiniRow({
  label,
  status,
  tone,
}: {
  label: string;
  status: string;
  tone: "ok" | "warn" | "neutral";
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
      <span className="flex min-w-0 items-center gap-2.5 text-[13px] font-medium">
        <span
          className={cn(
            "grid size-5 shrink-0 place-items-center rounded-full border",
            tone === "ok" ? "border-forest-800 bg-forest-800 text-cream-50" : "border-line-strong",
          )}
        >
          {tone === "ok" && <Check className="size-3" strokeWidth={3} />}
        </span>
        <span className="truncate">{label}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <Badge tone={tone === "neutral" ? "neutral" : tone}>{status}</Badge>
        <span className="hidden rounded-md bg-cream-200 px-1.5 py-0.5 font-mono text-[10px] text-ink-500 sm:inline">
          GOV.UK
        </span>
      </span>
    </div>
  );
}

export function FeatureBento() {
  return (
    <section id="features" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Not another information website"
          title="From the rules to the boarding gate."
          description="Government pages tell you what's required. PetJet turns it into timed tasks, checks your records and connects you with the people who can complete them."
        />

        <div className="mt-12 grid gap-4 md:grid-cols-6">
          <Tile
            className="md:col-span-4"
            icon={<ShieldCheck className="size-5" />}
            title="A plan built from official rules"
            body="Requirements for your pet, route and dates, each with its official source and the date we last checked it."
          >
            <div className="rounded-2xl border border-line bg-cream-50 px-4 py-1.5">
              <MiniRow label="Microchip" status="Verified" tone="ok" />
              <MiniRow label="Rabies vaccination" status="Due by 21 Feb" tone="warn" />
              <MiniRow label="Animal health certificate" status="6 to 15 Mar" tone="neutral" />
            </div>
          </Tile>

          <Tile
            className="md:col-span-2"
            delay={0.08}
            icon={<AlertTriangle className="size-5" />}
            title="Honest about your dates"
            body="If a waiting period can't finish in time, we say so and show the earliest date your pet can travel."
          >
            <div className="rounded-2xl border border-danger-700/15 bg-danger-100 p-4">
              <p className="text-[13px] font-semibold text-danger-700">Not ready for 10 Mar</p>
              <p className="mt-1 text-xs text-ink-700">21-day wait after vaccination ends 14 Mar.</p>
              <p className="tabular mt-3 text-2xl font-semibold tracking-tight text-forest-900">
                15 Mar
              </p>
              <p className="text-xs text-ink-500">Earliest possible departure</p>
            </div>
          </Tile>

          <Tile
            className="md:col-span-2"
            delay={0.04}
            icon={<FileText className="size-5" />}
            title="Records read for you"
            body="Upload a vet record and we pull out the microchip and dates, then flag anything that doesn't match."
          >
            <div className="rounded-2xl border border-line bg-cream-50 p-3.5 text-[13px]">
              <p className="flex items-center gap-2 font-medium">
                <FileText className="size-4 text-ink-400" /> rabies-certificate.pdf
              </p>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
                <dt className="text-ink-500">Microchip</dt>
                <dd className="tabular truncate text-right font-mono text-xs">956 000 012 345 678</dd>
                <dt className="text-ink-500">Vaccinated</dt>
                <dd className="tabular text-right">2 Jan 2027</dd>
              </dl>
              <div className="mt-3">
                <Badge tone="ok" dot>
                  Matches Milo&apos;s profile
                </Badge>
              </div>
            </div>
          </Tile>

          <Tile
            className="md:col-span-2"
            delay={0.12}
            icon={<Stethoscope className="size-5" />}
            title="The right vet, not just the nearest"
            body="Vets and labs matched by the service your plan needs, such as an official vet for a health certificate."
          >
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-cream-50 p-3.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sage-200 text-xs font-semibold text-forest-800">
                RV
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold">Riverside Veterinary Centre</p>
                <p className="flex items-center gap-1 text-xs text-ink-500">
                  <MapPin className="size-3" /> 1.2 miles · Official vet
                </p>
              </div>
            </div>
          </Tile>

          <Tile
            className="md:col-span-2"
            delay={0.2}
            icon={<Plane className="size-5" />}
            title="Flights that take your pet"
            body="See which partner flights accept your pet in the cabin or hold, then book and keep the e-ticket with your plan."
          >
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-cream-50 p-3.5">
              <div>
                <p className="tabular text-[13px] font-semibold">LHR → JFK</p>
                <p className="text-xs text-ink-500">Pet travels in hold</p>
              </div>
              <Badge tone="ok" dot>
                Accepts Milo
              </Badge>
            </div>
          </Tile>

          <Tile
            className="md:col-span-6"
            delay={0.08}
            dark
            icon={<Sparkles className="size-5" />}
            title="Ask anything about your trip"
            body="The PetJet assistant answers from your plan and the verified rules, shows its source, and tells you when to ask your vet instead."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex items-start gap-3 rounded-2xl bg-forest-700/60 p-4">
                <MessageCircle className="mt-0.5 size-4 shrink-0 text-sage-300" />
                <p className="text-[14px] text-cream-50">
                  Can I give the tapeworm treatment the week before we leave for Dublin?
                </p>
              </div>
              <div className="rounded-2xl bg-cream-50 p-4 text-ink-900">
                <p className="text-[14px] leading-relaxed">
                  Not a week before. For Ireland, a vet must treat your dog between 1 and 5 days
                  before you arrive. For a 15 Mar arrival that means 10 to 14 Mar.
                </p>
                <p className="mt-2 text-xs text-ink-500">Source: GOV.UK · Ireland DAFM</p>
              </div>
            </div>
          </Tile>
        </div>
      </div>
    </section>
  );
}
