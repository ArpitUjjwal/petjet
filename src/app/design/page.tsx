import type { Metadata } from "next";
import { PublicShell } from "@/components/shell/public-shell";
import { Showcase } from "./showcase";

export const metadata: Metadata = { title: "Design system" };

export default function DesignPage() {
  return (
    <PublicShell>
      <Showcase />
    </PublicShell>
  );
}
