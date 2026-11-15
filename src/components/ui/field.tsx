import { useId, type ComponentProps, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

const control =
  "h-11 w-full rounded-control border border-line-strong bg-surface px-3.5 text-sm text-ink-900 shadow-xs " +
  "placeholder:text-ink-400 transition-[border-color,box-shadow] duration-150 " +
  "hover:border-ink-400 focus:border-forest-700 focus:outline-none focus:ring-4 focus:ring-sage-200 " +
  "disabled:bg-cream-200 disabled:text-ink-400 aria-[invalid=true]:border-danger-700 aria-[invalid=true]:focus:ring-danger-100";

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  suffix?: ReactNode;
};

function FieldFrame({
  id,
  label,
  hint,
  error,
  optional,
  children,
}: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink-900">
        {label}
        {optional && <span className="ml-1 font-normal text-ink-400">(optional)</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} role="alert" className="text-[13px] text-danger-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="text-[13px] text-ink-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({
  label,
  hint,
  error,
  optional,
  suffix,
  className,
  id: idProp,
  ...props
}: FieldProps & ComponentProps<"input">) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error} optional={optional}>
      <div className="relative">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
          className={cn(control, suffix && "pr-12", className)}
          {...props}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[13px] text-ink-500">
            {suffix}
          </span>
        )}
      </div>
    </FieldFrame>
  );
}

export function Select({
  label,
  hint,
  error,
  optional,
  className,
  children,
  id: idProp,
  ...props
}: Omit<FieldProps, "suffix"> & ComponentProps<"select">) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error} optional={optional}>
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
          className={cn(control, "appearance-none pr-10", className)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-500"
        />
      </div>
    </FieldFrame>
  );
}

export function Textarea({
  label,
  hint,
  error,
  optional,
  className,
  id: idProp,
  ...props
}: Omit<FieldProps, "suffix"> & ComponentProps<"textarea">) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error} optional={optional}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        className={cn(control, "h-auto min-h-24 py-2.5", className)}
        {...props}
      />
    </FieldFrame>
  );
}
