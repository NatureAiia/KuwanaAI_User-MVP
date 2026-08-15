import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getShortsFeed } from "@/lib/shorts";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Header } from "@/components/Header";
import { ShortsFeed } from "@/components/shorts/ShortsFeed";

export default async function ShortsPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const cards = await getShortsFeed(user.id);

  return (
    <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col px-5 pt-6 md:px-10">
      <Header />
      <h1 className="font-display text-[24px] font-bold">Shorts</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        A personalized scroll through deals and products picked for you.
      </p>
      <div className="mt-4">
        <ShortsFeed cards={cards} />
      </div>
      <BottomTabBar />
    </div>
  );
}
