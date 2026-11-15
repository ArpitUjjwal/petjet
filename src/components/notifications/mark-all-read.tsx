"use client";

import { CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markAllReadAction } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";

export function MarkAllReadButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={pending}
      iconLeft={<CheckCheck className="size-4" />}
      onClick={() =>
        start(async () => {
          await markAllReadAction();
          router.refresh();
        })
      }
    >
      Mark all read
    </Button>
  );
}
