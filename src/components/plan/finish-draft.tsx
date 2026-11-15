"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createTrip } from "@/app/actions/trips";
import { ButtonLink } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { SUBMIT_KEY } from "./plan-wizard";

function readDraft(): unknown {
  try {
    const raw = window.localStorage.getItem(SUBMIT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const noopSubscribe = () => () => {};

/** After a guest signs up or logs in, saves the questionnaire they finished before. */
export function FinishDraft() {
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!hydrated) return <Working />;
  return <Finish />;
}

function Finish() {
  const [draft] = useState(readDraft);
  const [error, setError] = useState<string | undefined>(() =>
    draft ? undefined : "We couldn't find your answers in this browser. Please fill in the questionnaire again.",
  );
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || !draft) return;
    ran.current = true;
    createTrip(draft)
      .then((res) => {
        if (res && !res.ok) {
          setError(
            res.issues?.[0]?.message ??
              res.message ??
              "Some of your answers need checking, for example a date that has now passed.",
          );
        }
      })
      .catch((e: unknown) => {
        /* A redirect after success is thrown as a special error that Next handles itself */
        if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
        setError("Something went wrong saving your plan. Please try again.");
      });
  }, [draft]);

  if (error) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-5 py-16">
        <Callout tone="danger" icon={<AlertTriangle className="size-4.5" />} title="We couldn't build your plan">
          {error}
        </Callout>
        <ButtonLink href="/plan" className="self-start">
          Review my answers
        </ButtonLink>
      </div>
    );
  }
  return <Working />;
}

function Working() {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center" role="status">
      <Loader2 className="size-8 animate-spin text-forest-800" />
      <p className="text-lg font-semibold">Building your plan…</p>
      <p className="text-sm text-ink-500">Checking your answers against the rules for your route.</p>
    </div>
  );
}
