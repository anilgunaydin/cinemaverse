import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { getCurrentUser } from "@/lib/auth/current-user";
import { NotificationList } from "@/components/notifications/notification-list";

export const metadata: Metadata = { title: "Bildirimler" };

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <NotificationList />
      </main>
    </>
  );
}