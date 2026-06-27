import type { Metadata } from "next";
import "../globals.css";
import Navbar from "@/components/Navbar";

import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import Footer from "@/components/Footer";
import MainWrapper from "@/components/MainWrapper";

export const metadata: Metadata = {
  title: "EveBash | Premium Wedding Photography",
  description: "Capturing life's most beautiful moments.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className="antialiased bg-black text-slate-200 font-sans">
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
