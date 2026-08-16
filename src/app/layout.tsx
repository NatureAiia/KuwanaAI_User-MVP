import type { Metadata } from "next";
import { Bricolage_Grotesque, Manrope, IBM_Plex_Mono } from "next/font/google";
import { GamificationToastHost } from "@/components/GamificationToastHost";
import { CurrencyProvider } from "@/components/CurrencyProvider";
import { PageTransition } from "@/components/PageTransition";
import { SkipLink } from "@/components/SkipLink";
import { OfflineBanner } from "@/components/OfflineBanner";
import { SoftNavTracker } from "@/components/SoftNavTracker";
import { ScrollProgressBar } from "@/components/ScrollProgressBar";
import { GlobalBackToTop } from "@/components/GlobalBackToTop";
import { UtmTracker } from "@/components/UtmTracker";
import { getSiteUrl } from "@/lib/siteUrl";
import { THEME_INIT_SCRIPT } from "@/lib/themeScript";
import "./globals.css";
import "@/bones/registry";

const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "Kuwana — Compare smarter, gain more",
  description:
    "AI-assisted, explainable comparisons across telecom, banking, insurance, and education in Zimbabwe.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${manrope.variable} ${plexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-bg-base text-text-primary font-body">
        {/*
          A plain <script>, not next/script. next/script stamps the
          per-request CSP nonce onto whatever it renders, and browsers blank
          that attribute out after parsing — which made React report an
          attribute mismatch and abandon hydration on every page load. This
          script is a compile-time constant, so it is authorised by a CSP
          *hash* instead; see lib/themeScript.ts.

          Un-deferred on purpose: it must run before the first paint, or the
          page flashes the wrong theme, which is the whole reason it exists.
        */}
        <script
          id="theme-init"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
        <OfflineBanner />
        <SoftNavTracker />
        <UtmTracker />
        <ScrollProgressBar />
        <SkipLink />
        <GamificationToastHost />
        <CurrencyProvider>
          <PageTransition>{children}</PageTransition>
        </CurrencyProvider>
        <GlobalBackToTop />
      </body>
    </html>
  );
}
