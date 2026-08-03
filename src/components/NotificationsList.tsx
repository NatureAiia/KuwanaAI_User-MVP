"use client";

import { useState } from "react";
import Link from "next/link";
import { BellOff, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/Card";

type NotificationDTO = {
  id: string;
  message: string;
  read: boolean;
  createdAt: string;
  listing: { id: string; name: string; provider: string };
};

export function NotificationsList({ notifications }: { notifications: NotificationDTO[] }) {
  const [items, setItems] = useState(notifications);

  async function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await fetch(`/api/notifications/${id}`, { method: "PATCH" }).catch(() => {});
  }

  if (items.length === 0) {
    return (
      <div className="mt-10 flex flex-col items-center text-center text-text-muted">
        <BellOff size={32} />
        <p className="mt-3 text-[13px]">
          No notifications yet. Save a listing to get alerted when its price drops.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      {items.map((n) => (
        <Link key={n.id} href={`/listing/${n.listing.id}`} onClick={() => markRead(n.id)}>
          <Card className={n.read ? "opacity-60" : "border-accent-teal/40 bg-accent-teal/5"}>
            <div className="flex items-start gap-3">
              <TrendingDown size={18} className="mt-0.5 shrink-0 text-accent-teal" />
              <div>
                <p className="font-display text-[14px] font-semibold">{n.listing.name}</p>
                <p className="text-[11px] text-text-muted">{n.listing.provider}</p>
                <p className="mt-1 text-[13px] text-text-secondary">{n.message}</p>
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
