import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Header } from "@/components/Header";
import { ChatClientLazy } from "@/components/LazyClients";

export default async function ChatPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  return (
    <div className="flex flex-1 flex-col px-5 pt-6 md:px-10">
      <Header />
      <Suspense fallback={null}>
        <ChatClientLazy />
      </Suspense>
      <BottomTabBar />
    </div>
  );
}
