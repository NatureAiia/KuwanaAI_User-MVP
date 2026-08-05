import { Compass } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-16 text-center">
      <Compass size={40} className="text-accent-sky" />
      <h1 className="mt-4 font-display text-[22px] font-bold">Nothing here</h1>
      <p className="mt-2 max-w-[320px] text-[14px] text-text-secondary">
        This page doesn&apos;t exist, or the listing may no longer be available.
      </p>
      <LinkButton href="/explore" size="lg" className="mt-6">
        Back to Explore
      </LinkButton>
    </div>
  );
}
