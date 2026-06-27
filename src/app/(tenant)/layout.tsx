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
