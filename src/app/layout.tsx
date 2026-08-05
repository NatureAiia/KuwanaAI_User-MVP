import type { Metadata } from "next";
import { Bricolage_Grotesque, Manrope, IBM_Plex_Mono } from "next/font/google";
import { GamificationToastHost } from "@/components/GamificationToastHost";
import { CurrencyProvider } from "@/components/CurrencyProvider";
import { PageTransition } from "@/components/PageTransition";
import { THEME_INIT_SCRIPT } from "@/lib/themeScript";
import "./globals.css";

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
      className={`dark ${bricolage.variable} ${manrope.variable} ${plexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/*
          A plain <script>, not next/script. next/script stamps the
          per-request CSP nonce onto whatever it renders, and browsers blank
          that attribute out after parsing — which made React report an
          attribute mismatch and abandon hydration on every page load. This
          script is a compile-time constant, so it is authorised by a CSP
          *hash* instead; see lib/themeScript.ts for the full reasoning.

          In <head> and un-deferred on purpose: it must run before the first
          paint, or the page flashes dark before correcting itself, which is
          the entire reason it exists.

          suppressHydrationWarning because React does not own this element's
          contents — nothing here changes between renders, but the attribute
          set a browser ends up with for an inline script is not something
          worth asserting on.
        */}
        <script
          id="theme-init"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-bg-base text-text-primary font-body">
        <GamificationToastHost />
        <CurrencyProvider>
          <PageTransition>{children}</PageTransition>
        </CurrencyProvider>
      </body>
    </html>
  );
}
