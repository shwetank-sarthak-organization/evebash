import type { Metadata, Viewport } from "next";
import "../globals.css";
import { inter, playfair } from "../fonts";
import Navbar from "@/components/Navbar";

import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import Footer from "@/components/Footer";
import MainWrapper from "@/components/MainWrapper";

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
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth" className={`${inter.variable} ${playfair.variable}`}>
      <head>
        <link rel="icon" href="/evebash-logo-gold.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/evebash-logo-gold.png" type="image/png" />
        <link rel="apple-touch-icon" href="/evebash-logo-gold.png" />
      </head>
      <body className="antialiased font-sans">
        <AuthProvider>
          <ThemeProvider>
            <Navbar />
            <MainWrapper>
              {children}
            </MainWrapper>
            <Footer />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
