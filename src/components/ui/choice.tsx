"use client";

import { Check } from "lucide-react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Choice = { value: string; label: string; description?: string; icon?: ReactNode };

/** Radio buttons styled as selectable cards. Native inputs, so keyboard and screen readers just work. */
export function ChoiceGroup({
  legend,
  hint,
  name,
  options,
  value,
  onChange,
  error,
  columns = 3,
  size = "md",
}: {
  legend: string;
  hint?: string;
  name: string;
  options: Choice[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  columns?: 2 | 3 | 4;
  size?: "sm" | "md";
}) {
  const id = useId();
  return (
    <fieldset aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} aria-invalid={error ? true : undefined}>
      <legend className="text-[13px] font-medium text-ink-900">{legend}</legend>
      {hint && (
        <p id={`${id}-hint`} className="mt-0.5 text-[13px] text-ink-500">
          {hint}
        </p>
      )}
      <div
        className={cn(
          "mt-2 grid gap-2",
          columns === 2 && "sm:grid-cols-2",
          columns === 3 && "sm:grid-cols-3",
          columns === 4 && "grid-cols-2 sm:grid-cols-4",
        )}
      >
        {options.map((o) => {
          const checked = value === o.value;
          return (
            <label
              key={o.value}
              className={cn(
                "group relative flex cursor-pointer items-start gap-3 rounded-control border bg-surface transition-[border-color,box-shadow,background-color] duration-150",
                size === "sm" ? "px-3 py-2.5" : "px-3.5 py-3",
                checked
                  ? "border-forest-800 bg-sage-50 shadow-xs ring-1 ring-forest-800"
                  : "border-line-strong hover:border-ink-400",
                "has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-sage-200",
                error && !checked && "border-danger-700/50",
              )}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {o.icon && (
                <span
                  className={cn(
                    "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg transition-colors",
                    checked ? "bg-forest-800 text-cream-50" : "bg-sage-100 text-forest-800",
                  )}
                >
                  {o.icon}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink-900">{o.label}</span>
                {o.description && <span className="mt-0.5 block text-xs text-ink-500">{o.description}</span>}
              </span>
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-full border transition-colors",
                  checked ? "border-forest-800 bg-forest-800 text-cream-50" : "border-line-strong bg-surface",
                )}
              >
                {checked && <Check className="size-3" strokeWidth={3} />}
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1.5 text-[13px] text-danger-700">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function Checkbox({
  label,
  description,
  checked,
  onChange,
  name,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  name?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4.5 shrink-0 cursor-pointer rounded border-line-strong accent-forest-800"
      />
      <span>
        <span className="font-medium text-ink-900">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-ink-500">{description}</span>}
      </span>
    </label>
  );
}
