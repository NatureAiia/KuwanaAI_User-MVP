import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getShortsFeed } from "@/lib/shorts";
import { ShortsFeed } from "@/components/shorts/ShortsFeed";

export default async function ShortsPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const cards = await getShortsFeed(user.id);
  const listingIds = cards.filter((c) => c.kind === "listing").map((c) => c.id);
  const initialSavedIds = (
    await prisma.savedListing.findMany({
      where: { userId: user.id, listingId: { in: listingIds } },
      select: { listingId: true },
    })
  ).map((s) => s.listingId);

  // Full-bleed, no site Header/BottomTabBar — Shorts is a dedicated
  // immersive view, not a normal padded content page.
  return (
    <div id="main-content" tabIndex={-1} className="fixed inset-0">
      <ShortsFeed cards={cards} initialSavedIds={initialSavedIds} />
    </div>
  );
}
