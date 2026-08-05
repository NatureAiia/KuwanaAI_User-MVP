"use client";

import { useState } from "react";
import Link from "next/link";
import { BellOff, CheckCircle2, TrendingDown, XCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";

type NotificationType = "price_drop" | "listing_approved" | "listing_rejected";

type NotificationDTO = {
  id: string;
  type: NotificationType;
  message: string;
  read: boolean;
  createdAt: string;
  listing: { id: string; name: string; provider: string };
};

const ICON_BY_TYPE: Record<NotificationType, { icon: typeof TrendingDown; className: string }> = {
  price_drop: { icon: TrendingDown, className: "text-accent-teal" },
  listing_approved: { icon: CheckCircle2, className: "text-accent-teal" },
  listing_rejected: { icon: XCircle, className: "text-accent-coral" },
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
          No notifications yet. Save a listing to get alerted when its price drops, or submit one as a provider to
          hear back on it.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      {items.map((n) => {
        const { icon: Icon, className } = ICON_BY_TYPE[n.type];
        // A rejected (and often draft/pending) listing isn't published, so
        // /listing/[id] 404s on it — send provider-decision notifications to
        // /provider, where the provider actually manages the listing, instead.
        const href = n.type === "price_drop" ? `/listing/${n.listing.id}` : "/provider";
        return (
          <Link key={n.id} href={href} onClick={() => markRead(n.id)}>
            <Card className={n.read ? "opacity-60" : "border-accent-teal/40 bg-accent-teal/5"}>
              <div className="flex items-start gap-3">
                <Icon size={18} className={`mt-0.5 shrink-0 ${className}`} />
                <div>
                  <p className="font-display text-[14px] font-semibold">{n.listing.name}</p>
                  <p className="text-[11px] text-text-muted">{n.listing.provider}</p>
                  <p className="mt-1 text-[13px] text-text-secondary">{n.message}</p>
                </div>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
