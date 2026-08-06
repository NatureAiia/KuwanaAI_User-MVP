import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Header } from "@/components/Header";
import { ChatClient } from "@/components/chat/ChatClient";

export default async function ChatPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  return (
    <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col px-5 pt-6 md:px-10">
      <Header />
      <Suspense fallback={null}>
        <ChatClient />
      </Suspense>
      <BottomTabBar />
    </div>
  );
}
