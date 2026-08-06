import type { Metadata } from "next";
import { Bricolage_Grotesque, Manrope, IBM_Plex_Mono } from "next/font/google";
import Script from "next/script";
import { GamificationToastHost } from "@/components/GamificationToastHost";
import { CurrencyProvider } from "@/components/CurrencyProvider";
import { PageTransition } from "@/components/PageTransition";
import { getSiteUrl } from "@/lib/siteUrl";
import "./globals.css";

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var theme = localStorage.getItem("kuwana-theme");
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  } catch (e) {}
})();
`;

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
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <GamificationToastHost />
        <CurrencyProvider>
          <PageTransition>{children}</PageTransition>
        </CurrencyProvider>
      </body>
    </html>
  );
}
