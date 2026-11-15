import type { Metadata } from "next";
import { FinishDraft } from "@/components/plan/finish-draft";
import { requireOwner } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Building your plan" };

export default async function FinishPage() {
  await requireOwner();
  return <FinishDraft />;
}
