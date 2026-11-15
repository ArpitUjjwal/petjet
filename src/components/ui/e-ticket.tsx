"use client";

import { motion, useReducedMotion } from "framer-motion";
import { PawPrint, Plane } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "./badge";
import { cn } from "@/lib/cn";

export type ETicketData = {
  airline: string;
  airlineLogo?: ReactNode;
  /** A wide wordmark image, shown on a white pill instead of the square logo tile */
  airlineLogoSrc?: string;
  flightNumber: string;
  from: { code: string; city: string; time: string };
  to: { code: string; city: string; time: string };
  date: string;
  duration: string;
  passenger: string;
  pet: string;
  petPlacement: string;
  bookingRef: string;
  seat?: string;
  gate?: string;
};

function Cell({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="eyebrow text-[10px] text-ink-400">{label}</p>
      <p className="tabular mt-0.5 text-sm font-semibold text-ink-900">{value}</p>
    </div>
  );
}

/** Deterministic pseudo-barcode derived from the booking reference */
function Barcode({ seed }: { seed: string }) {
  const bars: number[] = [];
  let h = 7;
  for (let i = 0; i < 44; i++) {
    h = (h * 31 + seed.charCodeAt(i % seed.length) + i) % 9973;
    bars.push((h % 3) + 1);
  }
  return (
    <div aria-hidden className="flex h-12 w-full gap-[2px]">
      {bars.map((w, i) => (
        <span
          key={i}
          className="bg-ink-900"
          style={{ flexGrow: w, opacity: i % 2 ? 0.9 : 1 }}
        />
      ))}
    </div>
  );
}

export function ETicket({ ticket, className }: { ticket: ETicketData; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.article
      aria-label={`E-ticket ${ticket.flightNumber} ${ticket.from.code} to ${ticket.to.code}`}
      initial={reduce ? false : { opacity: 0, y: 24, rotateX: -12 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      style={{ transformPerspective: 1200 }}
      className={cn(
        "relative flex flex-col overflow-hidden rounded-card bg-surface shadow-raised sm:flex-row",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between gap-3 bg-forest-800 px-5 py-3.5 text-cream-50 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {ticket.airlineLogoSrc ? (
              <span className="grid h-8 shrink-0 place-items-center rounded-lg bg-white px-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ticket.airlineLogoSrc} alt="" className="h-4 w-auto max-w-[110px] object-contain" />
              </span>
            ) : (
              <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-cream-50 text-forest-800">
                {ticket.airlineLogo ?? <Plane className="size-4" />}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{ticket.airline}</p>
              <p className="tabular text-xs text-sage-300">{ticket.flightNumber}</p>
            </div>
          </div>
          <Badge tone="sample" className="border-sage-400 text-sage-200">
            Sample ticket
          </Badge>
        </header>

        <div className="px-5 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div>
              <p className="tabular text-3xl font-semibold tracking-tight sm:text-4xl">
                {ticket.from.code}
              </p>
              <p className="text-xs text-ink-500">{ticket.from.city}</p>
              <p className="tabular mt-1 text-sm font-medium">{ticket.from.time}</p>
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1 px-1">
              <p className="tabular text-xs text-ink-500">{ticket.duration}</p>
              <div className="flex w-full items-center gap-1.5 text-sage-500">
                <span className="size-1.5 rounded-full bg-current" />
                <span className="h-px flex-1 border-t border-dashed border-current" />
                <Plane className="size-4 rotate-45 text-forest-800" />
                <span className="h-px flex-1 border-t border-dashed border-current" />
                <span className="size-1.5 rounded-full bg-current" />
              </div>
              <p className="tabular text-xs font-medium text-ink-700">{ticket.date}</p>
            </div>
            <div className="text-right">
              <p className="tabular text-3xl font-semibold tracking-tight sm:text-4xl">
                {ticket.to.code}
              </p>
              <p className="text-xs text-ink-500">{ticket.to.city}</p>
              <p className="tabular mt-1 text-sm font-medium">{ticket.to.time}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-line pt-4 sm:grid-cols-4">
            <Cell label="Passenger" value={ticket.passenger} />
            <Cell
              label="Travelling pet"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <PawPrint className="size-3.5 text-tan-600" />
                  {ticket.pet}
                </span>
              }
            />
            <Cell label="Pet travels in" value={ticket.petPlacement} />
            <Cell label="Seat / Gate" value={`${ticket.seat ?? "—"} / ${ticket.gate ?? "—"}`} />
          </div>
        </div>
      </div>

      {/* Tear-off stub */}
      <div className="relative flex items-center gap-4 border-t border-dashed border-line-strong bg-cream-50 px-5 py-4 sm:w-44 sm:flex-col sm:justify-center sm:border-l sm:border-t-0 sm:px-5">
        <span
          aria-hidden
          className="absolute -top-3 left-[-12px] hidden size-6 rounded-full bg-cream-100 sm:block"
        />
        <span
          aria-hidden
          className="absolute -bottom-3 left-[-12px] hidden size-6 rounded-full bg-cream-100 sm:block"
        />
        <div className="flex-1 sm:w-full sm:flex-none sm:text-center">
          <p className="eyebrow text-[10px] text-ink-400">Booking ref</p>
          <p className="font-mono text-lg font-semibold tracking-widest">{ticket.bookingRef}</p>
        </div>
        <div className="w-32 shrink-0 sm:w-full">
          <Barcode seed={ticket.bookingRef} />
        </div>
      </div>
    </motion.article>
  );
}
