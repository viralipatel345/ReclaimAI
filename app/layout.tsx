import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { Fraunces, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { AppHeader, LegalNotice } from "@/components/AppHeader";
import { Providers } from "@/components/Providers";
import { isDemoMode, publicAppConfig } from "@/lib/config";
import "./globals.css";

const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], weight: ["600"], style: ["normal", "italic"] });
const instrument = Instrument_Sans({ variable: "--font-instrument", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Reclaim",
  description: "Enforce your 48-hour right to have non-consensual intimate images taken down.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icon-192.png", sizes: "192x192" }], apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Reclaim", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#F5F2EE",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection(); // read DEMO_MODE at request time, not build time
  const demo = isDemoMode();
  return (
    <html lang="en" className={`${fraunces.variable} ${instrument.variable} ${jetbrains.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <Providers demoMode={demo} config={publicAppConfig()}>
          <AppHeader />
          <main className="flex-1">{children}</main>
          <LegalNotice />
        </Providers>
      </body>
    </html>
  );
}
