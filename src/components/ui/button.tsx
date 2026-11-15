import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "accent" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "group/btn relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium select-none " +
  "transition-[background-color,box-shadow,transform,border-color,color] duration-200 ease-out-soft " +
  "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary:
    "bg-forest-800 text-cream-50 shadow-xs hover:bg-forest-700 hover:shadow-card",
  secondary:
    "bg-surface text-ink-900 border border-line-strong shadow-xs hover:border-forest-700/40 hover:bg-sage-50",
  ghost: "text-ink-700 hover:bg-sage-100 hover:text-ink-900",
  accent: "bg-tan-500 text-forest-950 shadow-xs hover:bg-tan-600 hover:text-cream-50",
  danger: "bg-danger-700 text-white shadow-xs hover:brightness-110",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconRight?: ReactNode;
  iconLeft?: ReactNode;
};

function Spinner() {
  return (
    <span
      aria-hidden
      className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  );
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  iconLeft,
  iconRight,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: CommonProps & ComponentProps<"button">) {
  return (
    <button
      type={type}
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : iconLeft}
      {children}
      {iconRight && (
        <span className="transition-transform duration-200 ease-out-soft group-hover/btn:translate-x-0.5">
          {iconRight}
        </span>
      )}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  iconLeft,
  iconRight,
  className,
  children,
  ...props
}: Omit<CommonProps, "loading"> & ComponentProps<typeof Link>) {
  return (
    <Link className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {iconLeft}
      {children}
      {iconRight && (
        <span className="transition-transform duration-200 ease-out-soft group-hover/btn:translate-x-0.5">
          {iconRight}
        </span>
      )}
    </Link>
  );
}
