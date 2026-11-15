import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";

export function Logo({
  href = "/",
  size = "md",
  tone = "dark",
  className,
}: {
  href?: string;
  size?: "sm" | "md";
  tone?: "dark" | "light";
  className?: string;
}) {
  const px = size === "sm" ? 32 : 38;
  return (
    <Link
      href={href}
      aria-label="PetJet home"
      className={cn("inline-flex items-center gap-2.5 rounded-control", className)}
    >
      <span
        className="relative shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-line"
        style={{ width: px, height: px }}
      >
        <Image
          src="/brand/petjet-mark.jpg"
          alt=""
          width={px * 2}
          height={px * 2}
          className="size-full scale-[1.45] object-cover"
          priority
        />
      </span>
      <span
        className={cn(
          "font-semibold tracking-tight",
          size === "sm" ? "text-[17px]" : "text-xl",
          tone === "dark" ? "text-forest-900" : "text-cream-50",
        )}
      >
        Pet<span className={tone === "dark" ? "text-tan-600" : "text-tan-500"}>Jet</span>
      </span>
    </Link>
  );
}
