/*
 * Date-only arithmetic on "YYYY-MM-DD" strings, done in UTC so results never
 * shift with the server's or browser's time zone.
 */
export type ISODate = string;

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== "string") return false;
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

function toDate(d: ISODate): Date {
  if (!isISODate(d)) throw new RangeError(`Not a valid date: ${String(d)}`);
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function toISODate(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

/** Today's date in the given IANA time zone (defaults to UK time). */
export function todayISO(timeZone = "Europe/London", now = new Date()): ISODate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts;
}

export function addDays(d: ISODate, days: number): ISODate {
  return toISODate(new Date(toDate(d).getTime() + days * DAY_MS));
}

/** Adds calendar months, clamping to the last day of a shorter month (31 Aug + 6 months = 28/29 Feb). */
export function addMonths(d: ISODate, months: number): ISODate {
  const date = toDate(d);
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const day = date.getUTCDate();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return toISODate(new Date(Date.UTC(y, m, Math.min(day, lastDay))));
}

/** Whole days from b to a (positive when a is later). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toDate(a).getTime() - toDate(b).getTime()) / DAY_MS);
}

export function isBefore(a: ISODate, b: ISODate) {
  return diffDays(a, b) < 0;
}

export function isAfter(a: ISODate, b: ISODate) {
  return diffDays(a, b) > 0;
}

export function maxDate(...dates: (ISODate | undefined)[]): ISODate | undefined {
  return dates.filter((d): d is ISODate => !!d).sort().at(-1);
}

export function minDate(...dates: (ISODate | undefined)[]): ISODate | undefined {
  return dates.filter((d): d is ISODate => !!d).sort()[0];
}

export function isWithin(d: ISODate, from: ISODate | undefined, to: ISODate | undefined) {
  return (!from || !isBefore(d, from)) && (!to || !isAfter(d, to));
}

/** "15 Mar 2027" */
export function formatDate(d: ISODate): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(toDate(d));
}

/** "15 Mar" */
export function formatShortDate(d: ISODate): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    toDate(d),
  );
}
