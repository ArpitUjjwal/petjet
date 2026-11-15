import clsx, { type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/* Teach tailwind-merge the project's custom token names so they resolve conflicts correctly. */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      rounded: [{ rounded: ["control", "card"] }],
      shadow: [{ shadow: ["xs", "card", "raised", "float"] }],
    },
  },
});

/** Joins class names; when two classes conflict, the later one wins. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
