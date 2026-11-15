"use client";

import { Check, FileSignature, FlaskConical, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  orderLabTestAction,
  postLabResultAction,
  recordVetServiceAction,
  respondToAppointmentAction,
} from "@/app/actions/vets";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { LAB_TESTS } from "@/lib/vets/core";

/* Interactive parts of the vet and lab portals. Pages refresh from the server after each action. */

export function RespondButtons({ id }: { id: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const act = (decision: "ACCEPTED" | "DECLINED") =>
    start(async () => {
      const r = await respondToAppointmentAction(id, decision);
      if (r.ok) toast({ tone: decision === "ACCEPTED" ? "ok" : "info", title: decision === "ACCEPTED" ? "Appointment confirmed" : "Request declined" });
      else toast({ tone: "danger", title: r.message ?? "Couldn't update the request." });
      router.refresh();
    });
  return (
    <div className="flex flex-wrap gap-2.5">
      <Button onClick={() => act("ACCEPTED")} loading={pending} iconLeft={<Check className="size-4" />}>
        Accept
      </Button>
      <Button variant="ghost" onClick={() => act("DECLINED")} disabled={pending} iconLeft={<X className="size-4" />}>
        Decline
      </Button>
    </div>
  );
}

export function RecordServiceForm({
  id,
  service,
  today,
  certificate,
}: {
  id: string;
  service: string;
  today: string;
  /** True when this issues a (demo) certificate rather than recording a treatment */
  certificate: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [date, setDate] = useState(today);
  const [chip, setChip] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  function submit() {
    setErrors({});
    setMessage(null);
    start(async () => {
      const r = await recordVetServiceAction(id, { date, microchipNumber: chip });
      if (r.ok) {
        toast({ title: certificate ? "Demo certificate issued" : "Treatment recorded", detail: r.summary });
        router.refresh();
      } else {
        setErrors(r.errors ?? {});
        setMessage(r.message ?? null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Input
        type="date"
        label={certificate ? "Date of issue" : "Date given"}
        value={date}
        max={today}
        onChange={(e) => setDate(e.target.value)}
        error={errors.date}
      />
      {service === "MICROCHIP" && (
        <Input label="Microchip number" inputMode="numeric" value={chip} onChange={(e) => setChip(e.target.value)} error={errors.microchipNumber} />
      )}
      {message && <p role="alert" className="text-[13px] text-danger-700">{message}</p>}
      <Button onClick={submit} loading={pending} iconLeft={<FileSignature className="size-4" />}>
        {certificate ? "Issue demo certificate" : "Record treatment"}
      </Button>
      {certificate && (
        <p className="text-[12px] text-ink-500">A simulated certificate for the demo. It isn&apos;t a real official document.</p>
      )}
    </div>
  );
}

export function OrderLabTest({ id }: { id: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [test, setTest] = useState<string>("RABIES_TITRE");
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Select label="Order a lab test" value={test} onChange={(e) => setTest(e.target.value)}>
          {Object.entries(LAB_TESTS).map(([k, t]) => (
            <option key={k} value={k}>
              {t.label}
            </option>
          ))}
        </Select>
      </div>
      <Button
        variant="secondary"
        loading={pending}
        iconLeft={<FlaskConical className="size-4" />}
        onClick={() =>
          start(async () => {
            const r = await orderLabTestAction(id, test);
            if (r.ok) toast({ title: "Test ordered", detail: "Sent to Northgate Pathology Laboratory." });
            else toast({ tone: "danger", title: r.message ?? "Couldn't order the test." });
            router.refresh();
          })
        }
      >
        Order test
      </Button>
    </div>
  );
}

export function LabResultForm({ id, test }: { id: string; test: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [value, setValue] = useState("");
  const [outcome, setOutcome] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const titre = test === "RABIES_TITRE";
  return (
    <div className="flex flex-col gap-4">
      {titre ? (
        <Input
          label="Titre result"
          inputMode="decimal"
          suffix="IU/mL"
          hint="0.5 IU/mL or more is a pass."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error={errors.value}
        />
      ) : (
        <Select label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} error={errors.outcome}>
          <option value="" disabled>
            Choose
          </option>
          <option value="PASS">No concerns found</option>
          <option value="FAIL">Concerns found</option>
        </Select>
      )}
      <Textarea label="Note" optional rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      <Button
        loading={pending}
        onClick={() =>
          start(async () => {
            setErrors({});
            const r = await postLabResultAction(id, { value, outcome, note });
            if (r.ok) {
              toast({ title: "Result posted", detail: r.summary });
              router.refresh();
            } else {
              setErrors(r.errors ?? {});
              if (r.message) toast({ tone: "danger", title: r.message });
            }
          })
        }
      >
        Post result
      </Button>
      <p className="text-[12px] text-ink-500">Results in this demo are samples, not real laboratory reports.</p>
    </div>
  );
}
