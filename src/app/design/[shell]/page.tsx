import { notFound } from "next/navigation";
import { AppShell, PageHeader, type ShellRole } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/feedback";

const previews: Record<string, { role: ShellRole; user: string; title: string; blurb: string }> = {
  "shell-owner": {
    role: "owner",
    user: "Mariyam Khan",
    title: "Welcome back, Mariyam.",
    blurb: "Owner app shell preview. Real pages arrive in later modules.",
  },
  "shell-vet": {
    role: "vet",
    user: "Dr Asha Patel",
    title: "Appointment requests",
    blurb: "Vet portal shell preview.",
  },
  "shell-lab": {
    role: "lab",
    user: "Northgate Pathology",
    title: "Test orders",
    blurb: "Lab portal shell preview.",
  },
};

/* Only the three known previews exist; anything else is a real 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(previews).map((shell) => ({ shell }));
}

export default async function ShellPreview({ params }: PageProps<"/design/[shell]">) {
  const { shell } = await params;
  const preview = previews[shell];
  if (!preview) notFound();

  return (
    <AppShell role={preview.role} userName={preview.user} unread={3}>
      <PageHeader
        title={preview.title}
        description={preview.blurb}
        action={<Badge tone="sample">Shell preview</Badge>}
      />
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="mt-3 h-8 w-1/3" />
            <Skeleton className="mt-6 h-20 w-full rounded-control" />
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
