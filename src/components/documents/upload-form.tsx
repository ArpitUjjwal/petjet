"use client";

import { FileUp, Lock, ScanSearch, X } from "lucide-react";
import { useActionState, useRef, useState, type DragEvent } from "react";
import { uploadDocumentAction, type UploadState } from "@/app/actions/documents";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { DOC_TYPES, DOC_TYPE_LABEL } from "@/lib/documents/extract";
import { fileSize } from "./doc-meta";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
const MAX = 10 * 1024 * 1024;

export function UploadForm({
  pets,
  defaultPet,
  defaultType,
}: {
  pets: { id: string; name: string }[];
  defaultPet?: string;
  defaultType?: string;
}) {
  const [state, action, pending] = useActionState<UploadState, FormData>(uploadDocumentAction, null);
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function pick(f: File | null) {
    setLocalError(null);
    if (!f) return setFile(null);
    if (!/\.(pdf|jpe?g|png)$/i.test(f.name) && !/^(application\/pdf|image\/(jpeg|png))$/.test(f.type)) {
      setLocalError("Upload a PDF, JPG or PNG file.");
    } else if (f.size > MAX) {
      setLocalError("Files can be up to 10 MB.");
    }
    setFile(f);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (!f || !input.current) return;
    const dt = new DataTransfer();
    dt.items.add(f);
    input.current.files = dt.files;
    pick(f);
  }

  const fileError = localError ?? state?.errors?.file;

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <div>
        <label
          htmlFor="document-file"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "group flex cursor-pointer flex-col items-center gap-3 rounded-card border-2 border-dashed px-6 py-10 text-center transition-colors duration-200",
            dragging ? "border-forest-700 bg-sage-100" : "border-line-strong bg-cream-50 hover:border-forest-700/50 hover:bg-sage-50",
            fileError && "border-danger-700/50",
          )}
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-surface text-forest-800 shadow-card transition-transform duration-300 ease-out-soft group-hover:-translate-y-0.5">
            <FileUp className="size-5" />
          </span>
          <span className="text-sm font-semibold text-ink-900">
            {file ? "Choose a different file" : "Drop a file here, or browse"}
          </span>
          <span className="text-[13px] text-ink-500">PDF, JPG or PNG, up to 10 MB</span>
          <input
            ref={input}
            id="document-file"
            name="file"
            type="file"
            accept={ACCEPT}
            aria-label="Document file"
            aria-invalid={fileError ? true : undefined}
            aria-describedby={fileError ? "document-file-msg" : undefined}
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
        </label>
        {file && (
          <div className="mt-3 flex items-center gap-3 rounded-control border border-line bg-surface px-3.5 py-2.5" data-testid="chosen-file">
            <FileUp className="size-4 shrink-0 text-ink-400" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{file.name}</span>
            <span className="tabular shrink-0 text-xs text-ink-500">{fileSize(file.size)}</span>
            <button
              type="button"
              aria-label="Remove file"
              className="grid size-7 place-items-center rounded-md text-ink-400 hover:bg-sage-100 hover:text-ink-900"
              onClick={() => {
                if (input.current) input.current.value = "";
                pick(null);
              }}
            >
              <X className="size-4" />
            </button>
          </div>
        )}
        {fileError && (
          <p id="document-file-msg" role="alert" className="mt-2 text-[13px] text-danger-700">
            {fileError}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Select name="petId" label="Which pet is it for?" defaultValue={defaultPet ?? (pets.length === 1 ? pets[0].id : "")} error={state?.errors?.petId}>
          {pets.length !== 1 && (
            <option value="" disabled>
              Choose a pet
            </option>
          )}
          {pets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select
          name="type"
          label="What kind of document?"
          defaultValue={defaultType ?? "AUTO"}
          hint="We'll work it out from a PDF's text if you're not sure."
        >
          <option value="AUTO">Work it out for me</option>
          {DOC_TYPES.map((t) => (
            <option key={t} value={t}>
              {DOC_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
      </div>

      {state?.message && (
        <p role="alert" className="text-[13px] text-danger-700">
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
        <p className="flex max-w-md items-start gap-2 text-[13px] text-ink-500">
          <Lock className="mt-0.5 size-3.5 shrink-0" />
          Stored privately for your account. Only you can open it, and nothing is shared until you choose to.
        </p>
        <Button type="submit" loading={pending} disabled={!file || !!localError} iconLeft={<ScanSearch className="size-4" />}>
          {pending ? "Reading your document…" : "Upload and read"}
        </Button>
      </div>
    </form>
  );
}
