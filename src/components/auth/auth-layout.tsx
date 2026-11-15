import { Check } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/logo";

export function AuthLayout({
  eyebrow,
  title,
  description,
  children,
  footer,
  panelTitle,
  panelPoints,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
  panelTitle: string;
  panelPoints: string[];
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="flex flex-col px-4 py-6 sm:px-10 lg:px-16">
        <Logo />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <div className="animate-rise">
            <p className="eyebrow text-tan-600">{eyebrow}</p>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{title}</h1>
            <p className="mt-2 text-[15px] text-ink-500">{description}</p>
            <div className="mt-8">{children}</div>
            <div className="mt-6 text-sm text-ink-500">{footer}</div>
          </div>
        </main>
      </div>

      <aside className="relative hidden overflow-hidden bg-forest-800 text-cream-50 lg:flex lg:flex-col lg:justify-between lg:p-14">
        <div
          aria-hidden
          className="absolute -right-32 -top-32 size-[520px] rounded-full bg-forest-700/60 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -left-24 size-[420px] rounded-full bg-tan-500/15 blur-3xl"
        />
        <div className="relative mx-auto mt-6 aspect-square w-full max-w-sm overflow-hidden rounded-[36px] bg-white shadow-float ring-1 ring-white/20">
          <Image
            src="/brand/petjet-illustration.jpg"
            alt=""
            fill
            sizes="800px"
            className="scale-[1.35] object-cover"
            priority
          />
        </div>
        <div className="relative">
          <h2 className="text-3xl font-semibold leading-tight">{panelTitle}</h2>
          <ul className="mt-6 flex flex-col gap-3">
            {panelPoints.map((point) => (
              <li key={point} className="flex items-start gap-3 text-[15px] text-sage-200">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-sage-500/40 text-cream-50">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
