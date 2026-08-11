"use client";

import { useRouter } from "next/navigation";
import { LinkButton } from "@/components/ui/Button";
import WaterButton from "@/components/ui/WaterButton";
import { useIsDesktop } from "@/lib/useIsDesktop";

export function HeaderGetStarted() {
  const router = useRouter();
  const isDesktop = useIsDesktop();

  if (!isDesktop) {
    return (
      <LinkButton href="/signup" variant="primary" size="md">
        Get started
      </LinkButton>
    );
  }

  return (
    <WaterButton
      label="Get started"
      onClick={() => router.push("/signup")}
      paddingX={20}
      paddingY={11}
      rounded={12}
      waterColor="#3E9BD6"
      textColor="#ffffff"
      font={{ fontSize: 14, fontWeight: 600 }}
      glass={{ tint: "rgba(62, 155, 214, 0.18)", blur: 24, frost: 10 }}
      borderOptions={{ color: "rgba(62, 155, 214, 0.5)", stroke: 1 }}
      shadowOptions={{ color: "#141A1F", intensity: 40 }}
    />
  );
}
