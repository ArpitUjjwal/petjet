import type { Metadata } from "next";
import { NotificationList } from "@/components/notifications/notification-list";
import { PageHeader } from "@/components/shell/app-shell";
import { requireProvider } from "@/lib/auth/session";
import { listNotifications } from "@/lib/notifications/repository";

export const metadata: Metadata = { title: "Notifications" };

export default async function ProviderNotifications() {
  const user = await requireProvider();
  const items = await listNotifications(user.id);
  return (
    <>
      <PageHeader
        title="Notifications"
        description={user.role === "LAB" ? "New test orders from partner vets." : "New requests from pet owners and lab results."}
      />
      <NotificationList
        items={items}
        emptyText={user.role === "LAB" ? "New test orders will show here." : "New appointment requests and lab results will show here."}
      />
    </>
  );
}
