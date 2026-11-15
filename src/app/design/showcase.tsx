"use client";

import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  FileText,
  Info,
  PawPrint,
  Plane,
  ShieldCheck,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog, Drawer } from "@/components/ui/dialog";
import { ETicket } from "@/components/ui/e-ticket";
import { Callout, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Input, Select, Textarea } from "@/components/ui/field";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Stepper } from "@/components/ui/stepper";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { Timeline } from "@/components/ui/timeline";
import { useToast } from "@/components/ui/toast";

const swatches = [
  ["forest-800", "bg-forest-800", "Primary"],
  ["forest-600", "bg-forest-600", "Primary hover"],
  ["sage-500", "bg-sage-500", "Sage"],
  ["sage-200", "bg-sage-200", "Sage tint"],
  ["sage-100", "bg-sage-100", "Sage wash"],
  ["cream-100", "bg-cream-100", "Page"],
  ["tan-500", "bg-tan-500", "Accent"],
  ["tan-100", "bg-tan-100", "Accent wash"],
  ["ink-900", "bg-ink-900", "Text"],
  ["ink-500", "bg-ink-500", "Muted text"],
] as const;

const steps = ["Pet details", "Travel plans", "Health & records", "Review"];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24">
      <h2 id={`${id}-h`} className="eyebrow mb-4 text-ink-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Showcase() {
  const { toast } = useToast();
  const [dialog, setDialog] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(3);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-4 py-10 sm:px-6 sm:py-14">
      <header className="animate-rise">
        <Badge tone="brand" dot>
          Module 0
        </Badge>
        <h1 className="display-lg mt-4">PetJet design system</h1>
        <p className="mt-3 max-w-2xl text-[15px] text-ink-500">
          Every screen in PetJet is assembled from the pieces on this page. Colours, type, spacing
          and motion come from one token file, so the whole product stays consistent.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          {[
            ["/design/shell-owner", "Owner shell"],
            ["/design/shell-vet", "Vet shell"],
            ["/design/shell-lab", "Lab shell"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 font-medium text-ink-700 transition-colors hover:border-forest-700/40 hover:bg-sage-50"
            >
              {label} <ArrowRight className="size-3.5" />
            </Link>
          ))}
        </div>
      </header>

      <Section id="colour" title="Colour">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {swatches.map(([name, cls, role]) => (
            <div key={name} className="overflow-hidden rounded-card border border-line bg-surface">
              <div className={`h-16 ${cls}`} />
              <div className="px-3 py-2.5">
                <p className="text-[13px] font-medium">{role}</p>
                <p className="font-mono text-[11px] text-ink-500">{name}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="type" title="Typography">
        <Card className="flex flex-col gap-5">
          <p className="display-xl">Pet travel, simplified.</p>
          <p className="display-lg">A plan that works backwards from take-off.</p>
          <p className="text-2xl font-semibold">Section heading</p>
          <p className="max-w-2xl text-[15px] leading-relaxed text-ink-700">
            Body copy is set in Geist at 15px with relaxed leading. Dates and counts use tabular
            numerals so columns line up:{" "}
            <span className="tabular font-medium">15 Mar 2027 · 42 days · 3 / 7</span>.
          </p>
          <p className="eyebrow text-ink-500">Eyebrow label</p>
        </Card>
      </Section>

      <Section id="buttons" title="Buttons">
        <Card className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button iconRight={<ArrowRight className="size-4" />}>Plan my trip</Button>
            <Button variant="secondary">How it works</Button>
            <Button variant="accent" iconLeft={<Plane className="size-4" />}>
              Book flight
            </Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="danger">Delete pet</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button loading>Saving</Button>
            <Button disabled>Disabled</Button>
          </div>
        </Card>
      </Section>

      <Section id="forms" title="Form controls">
        <Card>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input label="Pet name" placeholder="e.g. Milo" />
            <Select label="Species" defaultValue="">
              <option value="" disabled>
                Select species
              </option>
              <option>Dog</option>
              <option>Cat</option>
              <option>Ferret</option>
            </Select>
            <Input label="Weight" optional placeholder="e.g. 4.5" suffix="kg" inputMode="decimal" />
            <Input
              label="Microchip number"
              defaultValue="98100012345"
              error="A microchip number has 15 digits."
            />
            <Input label="Travel date" type="date" hint="We work every deadline back from this date." />
            <Input label="Locked field" defaultValue="Great Britain" disabled />
            <div className="sm:col-span-2">
              <Textarea label="Notes for your vet" optional placeholder="Anything they should know" />
            </div>
          </div>
        </Card>
      </Section>

      <Section id="status" title="Status badges">
        <Card className="flex flex-wrap gap-2">
          <Badge tone="ok" dot>
            Verified
          </Badge>
          <Badge tone="warn" dot>
            Due in 7 days
          </Badge>
          <Badge tone="danger" dot>
            Blocking
          </Badge>
          <Badge tone="info" dot>
            Needs review
          </Badge>
          <Badge tone="brand">Travel Plan</Badge>
          <Badge tone="neutral">Not started</Badge>
          <Badge tone="sample">Simulated slot</Badge>
        </Card>
      </Section>

      <Section id="stepper" title="Stepper">
        <Card>
          <Stepper steps={steps} current={step} />
          <div className="mt-6 flex justify-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              Back
            </Button>
            <Button
              size="sm"
              onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
              disabled={step === steps.length - 1}
            >
              Continue
            </Button>
          </div>
        </Card>
      </Section>

      <Section id="bento" title="Dashboard cards">
        <div className="grid gap-4 md:grid-cols-6">
          <Card tone="forest" className="relative overflow-hidden md:col-span-3">
            <p className="eyebrow text-sage-300">Departure</p>
            <p className="tabular mt-3 text-5xl font-semibold tracking-tight">42</p>
            <p className="mt-1 text-sm text-sage-200">days until Milo flies to France</p>
            <Plane
              aria-hidden
              className="absolute -right-4 -bottom-6 size-36 rotate-12 text-forest-700"
              strokeWidth={1}
            />
          </Card>
          <Card className="flex items-center gap-5 md:col-span-3" interactive>
            <ProgressRing value={done} max={7} label="Tasks completed">
              <span>
                <span className="tabular block text-xl font-semibold leading-none">{done}/7</span>
                <span className="text-[11px] text-ink-500">tasks</span>
              </span>
            </ProgressRing>
            <div>
              <p className="text-base font-semibold">Readiness</p>
              <p className="mt-0.5 text-sm text-ink-500">Next: verify rabies vaccination</p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-3"
                onClick={() => setDone((d) => (d >= 7 ? 0 : d + 1))}
              >
                Complete a task
              </Button>
            </div>
          </Card>
          <Card tone="sage" className="md:col-span-2" interactive>
            <CalendarDays className="size-5 text-forest-700" />
            <p className="mt-3 text-sm font-semibold">Vet appointment</p>
            <p className="tabular text-sm text-ink-500">1 Mar 2027, 10:30</p>
          </Card>
          <Card tone="tan" className="md:col-span-2" interactive>
            <FileText className="size-5 text-tan-700" />
            <p className="mt-3 text-sm font-semibold">2 documents verified</p>
            <p className="text-sm text-ink-500">1 needs review</p>
          </Card>
          <Card className="md:col-span-2" interactive>
            <ShieldCheck className="size-5 text-forest-700" />
            <p className="mt-3 text-sm font-semibold">Insurance</p>
            <p className="text-sm text-ink-500">Check overseas cover</p>
          </Card>
        </div>
      </Section>

      <Section id="timeline" title="Timeline and callouts">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader title="Preparation timeline" description="Calculated back from departure" />
            <Timeline
              items={[
                { id: "1", date: "Today", title: "Set up your travel plan", state: "done" },
                {
                  id: "2",
                  date: "By 21 Feb",
                  title: "Rabies vaccination",
                  detail: "Must be at least 21 days before travel",
                  state: "next",
                },
                {
                  id: "3",
                  date: "6 – 15 Mar",
                  title: "Animal health certificate",
                  detail: "Issued within 10 days of entry",
                  state: "upcoming",
                },
                {
                  id: "4",
                  date: "10 Mar",
                  title: "Tapeworm treatment window missed",
                  state: "blocked",
                },
                { id: "5", date: "15 Mar", title: "Travel date", state: "travel" },
              ]}
            />
          </Card>
          <div className="flex flex-col gap-3">
            <Callout tone="danger" icon={<AlertTriangle className="size-4.5" />} title="This trip is not ready">
              The 21-day wait after rabies vaccination ends after your departure date. Earliest
              feasible departure: 22 Mar 2027.
            </Callout>
            <Callout tone="warn" icon={<AlertTriangle className="size-4.5" />} title="Vaccination date unknown">
              Upload a record or ask your vet to confirm it.
            </Callout>
            <Callout tone="info" icon={<Info className="size-4.5" />} title="Source: GOV.UK">
              Last verified 14 Nov 2026.
            </Callout>
            <Callout tone="ok" icon={<ShieldCheck className="size-4.5" />} title="Microchip matches your record" />
          </div>
        </div>
      </Section>

      <Section id="table" title="Table">
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Document</Th>
                <Th>Status</Th>
                <Th>Date added</Th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Rabies vaccination record.pdf", "ok", "Verified", "12 Feb 2027"],
                ["Microchip certificate.pdf", "ok", "Verified", "12 Feb 2027"],
                ["Health certificate.pdf", "info", "Needs review", "14 Feb 2027"],
              ].map(([name, tone, status, date]) => (
                <Tr key={name}>
                  <Td>
                    <span className="flex items-center gap-3 font-medium">
                      <FileText className="size-4 text-ink-400" />
                      {name}
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={tone as "ok" | "info"} dot>
                      {status}
                    </Badge>
                  </Td>
                  <Td className="tabular text-ink-500">{date}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </Section>

      <Section id="overlays" title="Dialog, drawer and toast">
        <Card className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setDialog(true)}>
            Open dialog
          </Button>
          <Button variant="secondary" onClick={() => setDrawer(true)}>
            Open drawer
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast({ title: "Appointment requested", detail: "Riverside Vets will confirm a slot." })
            }
          >
            Show toast
          </Button>
        </Card>
        <Dialog
          open={dialog}
          onClose={() => setDialog(false)}
          title="Share this record?"
          description="Riverside Vets will be able to view Milo's rabies vaccination record."
          footer={
            <>
              <Button variant="ghost" onClick={() => setDialog(false)}>
                Not now
              </Button>
              <Button onClick={() => setDialog(false)}>Share record</Button>
            </>
          }
        >
          <p className="text-sm text-ink-700">
            You can stop sharing at any time from Documents. Providers only ever see records you
            choose to share.
          </p>
        </Dialog>
        <Drawer
          open={drawer}
          onClose={() => setDrawer(false)}
          title="Rabies vaccination"
          description="Why this is on your checklist"
        >
          <p className="text-sm leading-relaxed text-ink-700">
            Your pet must be vaccinated against rabies and then wait 21 days before entering the
            EU. The drawer is used for task details, sources and the concierge.
          </p>
        </Drawer>
      </Section>

      <Section id="states" title="Loading and empty states">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <div className="flex items-center gap-4">
              <Skeleton className="size-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
            <Skeleton className="mt-5 h-24 w-full rounded-control" />
          </Card>
          <EmptyState
            icon={<PawPrint className="size-5" />}
            title="No pets yet"
            description="Add your first pet to start a travel plan."
            action={<Button iconLeft={<Upload className="size-4" />}>Add a pet</Button>}
          />
        </div>
      </Section>

      <Section id="ticket" title="E-ticket">
        <ETicket
          ticket={{
            airline: "Sample Airways",
            flightNumber: "SA 0304",
            from: { code: "LHR", city: "London", time: "09:10" },
            to: { code: "CDG", city: "Paris", time: "11:25" },
            date: "15 Mar 2027",
            duration: "1h 15m",
            passenger: "Mariyam Khan",
            pet: "Milo (cat)",
            petPlacement: "Cabin",
            bookingRef: "PJ7K2Q",
            seat: "14A",
            gate: "B32",
          }}
        />
      </Section>
    </div>
  );
}
