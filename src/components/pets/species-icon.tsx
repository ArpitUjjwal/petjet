import { Cat, Dog, PawPrint } from "lucide-react";
import { cn } from "@/lib/cn";

export function SpeciesIcon({ species, className }: { species: string; className?: string }) {
  const Icon = species === "DOG" ? Dog : species === "CAT" ? Cat : PawPrint;
  return <Icon className={cn("size-5", className)} aria-hidden />;
}
