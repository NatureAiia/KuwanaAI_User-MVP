"use client";

import { useRouter } from "next/navigation";
import { LinkButton } from "@/components/ui/Button";
import WaterButton from "@/components/ui/WaterButton";
import { MagneticWrapper } from "@/components/ui/MagneticWrapper";
import { useIsDesktop } from "@/lib/useIsDesktop";

export function GetStartedButton() {
  const router = useRouter();
  const isDesktop = useIsDesktop();

  if (!isDesktop) {
    return (
      <LinkButton href="/signup" variant="primary" size="lg">
        Get started
      </LinkButton>
    );
  }

  return (
    <MagneticWrapper magnet={50} className="inline-block">
      <WaterButton
        label="Get started"
        onClick={() => router.push("/signup")}
        paddingX={32}
        paddingY={16}
        rounded={14}
        waterColor="#3E9BD6"
        textColor="#ffffff"
        font={{ fontSize: 15, fontWeight: 600 }}
        glass={{ tint: "rgba(62, 155, 214, 0.18)", blur: 24, frost: 10 }}
        borderOptions={{ color: "rgba(62, 155, 214, 0.5)", stroke: 1 }}
        shadowOptions={{ color: "#141A1F", intensity: 40 }}
      />
    </MagneticWrapper>
  );
}
