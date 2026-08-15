import Image from "next/image";
import { LinkButton } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HeaderGetStarted } from "@/components/landing/HeaderGetStarted";
import Text3DFlip from "@/components/ui/Text3DFlip";

export function LandingHeader() {
  return (
    <header className="flex items-center justify-between px-5 py-4 md:px-10">
      <div className="flex items-center gap-2">
        <Image src="/kuwana-mark.png" alt="" width={28} height={28} />
        <Text3DFlip
          text="kuwana.ai"
          tag="span"
          animation="enter"
          intervalMs={45000}
          color="var(--text-primary)"
          font={{
            fontFamily: "var(--font-display)",
            fontSize: 20,
            fontWeight: 700,
            lineHeight: "1em",
            letterSpacing: "-0.025em",
            textAlign: "left",
          }}
          style={{ width: "auto", height: "auto", display: "inline-flex" }}
        />
      </div>
      <nav className="flex items-center gap-3">
        <div className="hidden md:block">
          <LinkButton href="/login" variant="ghost" size="md">
            Log in
          </LinkButton>
        </div>
        <div className="hidden md:block">
          <HeaderGetStarted />
        </div>
        <ThemeToggle />
      </nav>
    </header>
  );
}