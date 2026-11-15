"use client";

import { ExternalLink, FileText, ScanText } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

export type PreviewLine = { text: string; fields: string[] };

/**
 * The document beside its details. "Text we read" shows the text layer with every line a
 * detail came from highlighted, which works in any browser; "Original" shows the file itself.
 */
export function DocumentPreview({
  fileUrl,
  fileName,
  isImage,
  pages,
}: {
  fileUrl: string;
  fileName: string;
  isImage: boolean;
  /** Empty when the file has no text layer */
  pages: PreviewLine[][];
}) {
  const hasText = pages.some((p) => p.length > 0);
  const [view, setView] = useState<"text" | "original">(hasText ? "text" : "original");
  const tabs = [
    ...(hasText ? [{ id: "text" as const, label: "Text we read", icon: ScanText }] : []),
    { id: "original" as const, label: "Original", icon: FileText },
  ];

  return (
    <div className="flex flex-col gap-3">
      {tabs.length > 1 && (
        <div role="tablist" aria-label="Preview" className="inline-flex self-start rounded-control border border-line bg-cream-50 p-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-[7px] px-3 text-[13px] font-medium transition-colors",
                view === id ? "bg-surface text-ink-900 shadow-xs" : "text-ink-500 hover:text-ink-900",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-card border border-line bg-cream-200 shadow-card" role="tabpanel">
        {view === "text" ? (
          <div className="max-h-[70vh] overflow-auto p-4 sm:p-6" data-testid="text-preview">
            {pages.map((lines, i) => (
              <div key={i} className="mx-auto mb-4 max-w-xl rounded-md bg-white p-5 shadow-card last:mb-0 sm:p-7">
                {pages.length > 1 && <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-ink-400">Page {i + 1}</p>}
                <div className="flex flex-col gap-1">
                  {lines.map((l, j) => (
                    <p
                      key={j}
                      data-highlight={l.fields.length ? "true" : undefined}
                      className={cn(
                        "relative rounded px-1.5 py-0.5 font-mono text-[12px] leading-relaxed text-ink-700 [overflow-wrap:anywhere]",
                        l.fields.length && "bg-tan-100 text-ink-900 ring-1 ring-tan-200",
                      )}
                    >
                      {l.text}
                      {l.fields.length > 0 && (
                        <span className="ml-2 inline-flex rounded bg-tan-500 px-1.5 align-middle font-sans text-[10px] font-semibold text-forest-950">
                          {l.fields.join(", ")}
                        </span>
                      )}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fileUrl} alt={`${fileName}, as uploaded`} className="max-h-[70vh] w-full object-contain" />
        ) : (
          <object data={`${fileUrl}#view=FitH&toolbar=0`} type="application/pdf" aria-label={`Preview of ${fileName}`} className="h-[60vh] w-full bg-white lg:h-[70vh]">
            <div className="grid h-[40vh] place-items-center p-6 text-center">
              <div>
                <FileText className="mx-auto size-8 text-ink-400" />
                <p className="mt-3 text-sm font-medium">This browser can&apos;t show PDFs inside the page.</p>
                <a href={fileUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-forest-800 hover:underline">
                  Open the PDF <ExternalLink className="size-3.5" />
                </a>
              </div>
            </div>
          </object>
        )}
      </div>
    </div>
  );
}
