"use client";

import { AlertTriangle, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { deletePet, savePet } from "@/app/actions/pets";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Callout } from "@/components/ui/feedback";
import { issuesToErrors, petHealthSchema, petProfileSchema } from "@/lib/trips/schemas";
import { PetHealthFields, PetProfileFields } from "./pet-fields";
import {
  emptyHealth,
  emptyProfile,
  healthFromStored,
  healthInput,
  profileFromStored,
  profileInput,
  type StoredPet,
} from "./pet-form-state";

function prefixed(p: string, e: Record<string, string>) {
  return Object.fromEntries(Object.entries(e).map(([k, v]) => [`${p}.${k}`, v]));
}

export function PetEditor({ pet, today, tripCount = 0 }: { pet?: StoredPet; today: string; tripCount?: number }) {
  const [profile, setProfile] = useState(pet ? profileFromStored(pet) : emptyProfile());
  const [health, setHealth] = useState(pet ? healthFromStored(pet) : emptyHealth());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = petProfileSchema(today).safeParse(profileInput(profile));
    const h = petHealthSchema(today).safeParse(healthInput(health));
    const next = {
      ...(p.success ? {} : prefixed("profile", issuesToErrors(p.error))),
      ...(h.success ? {} : prefixed("health", issuesToErrors(h.error))),
    };
    setErrors(next);
    if (Object.keys(next).length) {
      setMessage("Check the highlighted answers.");
      return;
    }
    setMessage(undefined);
    start(async () => {
      const res = await savePet({ profile: profileInput(profile), health: healthInput(health) }, pet?.id);
      if (res && !res.ok) {
        setErrors(res.errors ?? {});
        setMessage(res.message ?? "Check the highlighted answers.");
      }
    });
  }

  const unsupported = profile.species === "OTHER";

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {message && <Callout tone="danger" icon={<AlertTriangle className="size-4.5" />} title={message} />}
      <Card>
        <h2 className="mb-5 text-base font-semibold">About your pet</h2>
        <PetProfileFields value={profile} onChange={setProfile} errors={errors} today={today} askPedigree />
      </Card>
      {!unsupported && (
        <Card>
          <h2 className="mb-1 text-base font-semibold">Health</h2>
          <p className="mb-5 text-sm text-ink-500">
            Your answers shape every plan. You can update them any time, and records you upload later are
            checked against them.
          </p>
          <PetHealthFields
            petName={profile.name || "your pet"}
            value={health}
            onChange={setHealth}
            errors={errors}
            today={today}
          />
        </Card>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {pet ? (
          <Button
            variant="ghost"
            className="text-danger-700 hover:bg-danger-100 hover:text-danger-700"
            iconLeft={<Trash2 className="size-4" />}
            onClick={() => setConfirm(true)}
          >
            Delete pet
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-3">
          <Link
            href="/app/pets"
            className="inline-flex h-10 items-center rounded-control px-4 text-sm font-medium text-ink-700 hover:bg-sage-100"
          >
            Cancel
          </Link>
          <Button type="submit" loading={pending} disabled={unsupported}>
            {pet ? "Save changes" : "Add pet"}
          </Button>
        </div>
      </div>

      {pet && (
        <Dialog
          open={confirm}
          onClose={() => setConfirm(false)}
          title={`Delete ${pet.name}?`}
          description={
            tripCount > 0
              ? `${pet.name} is on ${tripCount} trip${tripCount === 1 ? "" : "s"}. Trips with no other pets will be deleted too.`
              : "This removes the pet and its health answers."
          }
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                Keep
              </Button>
              <Button variant="danger" onClick={() => start(() => deletePet(pet.id))} loading={pending}>
                Delete pet
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink-700">This can&apos;t be undone.</p>
        </Dialog>
      )}
    </form>
  );
}
