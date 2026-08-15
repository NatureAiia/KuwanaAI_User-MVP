import { Suspense } from "react";
import { ChatClientLazy } from "@/components/LazyClients";

// corporate/layout.tsx already handles the auth gate + chrome (CorporateHeader
// + CorporatePortalNav) — this just renders the same ChatClient the consumer
// /chat page uses. api/chat/route.ts is what actually branches grounding by
// role, so no corporate-specific chat component is needed here.
export default function CorporateChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatClientLazy variant="corporate" />
    </Suspense>
  );
}
