"use client";

import { useState, type ReactNode } from "react";
import { Bell, BellOff } from "lucide-react";
import { Card } from "@/components/ui/Card";

export type InboxNotificationDTO = {
  id: string;
  message: string;
  read: boolean;
  createdAt: string;
};

/**
 * Shared list for the corporate and admin notification pages — unlike the
 * consumer NotificationsList, these notifications aren't tied to a listing
 * to link to, so each row is a click-to-mark-read card instead of a Link.
 */
export function NotificationInbox({
  notifications,
  emptyMessage,
}: {
  notifications: InboxNotificationDTO[];
  emptyMessage: ReactNode;
}) {
  const [items, setItems] = useState(notifications);

  async function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await fetch(`/api/notifications/${id}`, { method: "PATCH" }).catch(() => {});
  }

  if (items.length === 0) {
    return (
      <div className="mt-6 flex flex-col items-center text-center text-text-muted">
        <BellOff size={32} />
        <div className="mt-3 text-[13px]">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      {items.map((n) => (
        <button key={n.id} type="button" onClick={() => markRead(n.id)} className="text-left">
          <Card className={n.read ? "opacity-60" : "border-accent-teal/40 bg-accent-teal/5"}>
            <div className="flex items-start gap-3">
              <Bell size={18} className="mt-0.5 shrink-0 text-accent-teal" />
              <div>
                <p className="text-[13px] text-text-secondary">{n.message}</p>
                <p className="mt-1 text-[11px] text-text-muted">
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          </Card>
        </button>
      ))}
    </div>
  );
}
