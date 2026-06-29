import type { Metadata } from "next";
import "./tenant.css";
import { AuthProvider } from "@/context/AuthContext";
import TenantGuard from "@/components/TenantGuard";

export const metadata: Metadata = {
  title: "Wedding Album",
  description: "Our Wedding Celebration",
};

export default function TenantLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Lato:wght@100;300;400;700;900&family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased font-sans">
        <AuthProvider>
          <main className="min-h-screen">
            <TenantGuard>
              {children}
            </TenantGuard>
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
