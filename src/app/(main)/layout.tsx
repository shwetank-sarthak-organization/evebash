import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "../globals.css";
import { brand, inter, playfair } from "../fonts";
import Navbar from "@/components/Navbar";

import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { UploadProvider } from "@/context/UploadContext";
import Footer from "@/components/Footer";
import MainWrapper from "@/components/MainWrapper";
import { OpenInAppBanner } from "@/components/OpenInAppBanner";
import { MobileAppGate } from "@/components/MobileAppGate";
import { APP_GATE_ENABLED, appGateHeadScript } from "@/lib/appGate";
import { jsonLd, siteUrl } from "@/lib/seo";

// Who EveBash is, for search engines (brand result, logo, contact).
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "EveBash",
      url: siteUrl,
      logo: `${siteUrl}/evebash-logo-gold.png`,
      email: "support@evebash.com",
      sameAs: ["https://www.youtube.com/@EveBashApp"],
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: "EveBash",
      url: siteUrl,
      publisher: { "@id": `${siteUrl}/#organization` },
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.evebash.com"),
  title: {
    default: "EveBash | Event media platform for photographers and organizers",
    template: "%s · EveBash",
  },
  description: "Upload, organize and share every event's photos and videos with your clients and guests.",
  applicationName: "EveBash",
  openGraph: {
    type: "website",
    siteName: "EveBash",
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image" },
  icons: {
    icon: [
      { url: "/evebash-logo-gold.svg", type: "image/svg+xml" },
      { url: "/evebash-logo-gold.png", type: "image/png" },
    ],
    shortcut: "/evebash-logo-gold.svg",
    apple: "/evebash-logo-gold.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#13191F",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth" className={`${inter.variable} ${playfair.variable} ${brand.variable}`}>
      <head>
        <link rel="icon" href="/evebash-logo-gold.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/evebash-logo-gold.png" type="image/png" />
        <link rel="apple-touch-icon" href="/evebash-logo-gold.png" />
        {APP_GATE_ENABLED && <script dangerouslySetInnerHTML={{ __html: appGateHeadScript }} />}
      </head>
      <body className="antialiased font-sans site-palette">
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(organizationJsonLd)} />
        <AuthProvider>
          {APP_GATE_ENABLED && <MobileAppGate />}
          <ThemeProvider>
            <UploadProvider>
              <Navbar />
              <MainWrapper>
                {children}
              </MainWrapper>
              <Footer />
              <Suspense fallback={null}>
                <OpenInAppBanner />
              </Suspense>
            </UploadProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
