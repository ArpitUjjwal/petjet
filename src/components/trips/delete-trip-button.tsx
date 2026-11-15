"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteTrip } from "@/app/actions/trips";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export function DeleteTripButton({ tripId }: { tripId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <Button
        variant="ghost"
        className="text-danger-700 hover:bg-danger-100 hover:text-danger-700"
        iconLeft={<Trash2 className="size-4" />}
        onClick={() => setOpen(true)}
      >
        Delete trip
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Delete this trip?"
        description="The plan is removed. Your pets and their details stay in My pets."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Keep trip
            </Button>
            <Button variant="danger" loading={pending} onClick={() => start(() => deleteTrip(tripId))}>
              Delete trip
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-700">This can&apos;t be undone.</p>
      </Dialog>
    </>
  );
}
