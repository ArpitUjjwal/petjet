import { formatDate, formatShortDate, type ISODate } from "@/lib/rules/dates";

/**
 * The window as an owner should read it today: a window that is already open is just a
 * deadline ("By 26 Nov"), so only future start dates are shown.
 */
export function openWindow(window: { from?: ISODate; to?: ISODate } | undefined, today: ISODate) {
  if (!window) return undefined;
  if (window.from && window.to && window.from <= today) return { to: window.to };
  return window;
}

/** "6 – 15 Mar 2027", "By 21 Feb 2027", "From 29 Mar 2027" */
export function windowLabel(window?: { from?: ISODate; to?: ISODate }) {
  if (!window) return null;
  const { from, to } = window;
  if (from && to) {
    if (from === to) return formatDate(to);
    const sameYear = from.slice(0, 4) === to.slice(0, 4);
    return `${sameYear ? formatShortDate(from) : formatDate(from)} – ${formatDate(to)}`;
  }
  if (to) return `By ${formatDate(to)}`;
  if (from) return `From ${formatDate(from)}`;
  return null;
}

/** "3 years", "5 months", "Under 1 month" from a birth month and year */
export function ageLabel(birthYear: number, birthMonth: number, today: ISODate) {
  const [y, m] = today.split("-").map(Number);
  const months = (y - birthYear) * 12 + (m - birthMonth);
  if (months < 1) return "Under 1 month";
  if (months < 24) return `${months} month${months === 1 ? "" : "s"}`;
  const years = Math.floor(months / 12);
  return `${years} years`;
}

export const SPECIES_NAME: Record<string, string> = { DOG: "Dog", CAT: "Cat", FERRET: "Ferret" };
