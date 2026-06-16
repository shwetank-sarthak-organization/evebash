import type { Metadata } from "next";
import { Playfair_Display, Lato } from "next/font/google";
import "../globals.css";

import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import Footer from "@/components/Footer";

const playfair = Playfair_Display({
    subsets: ["latin"],
    variable: "--font-playfair",
    display: "swap",
});

const lato = Lato({
    weight: ["100", "300", "400", "700", "900"],
    subsets: ["latin"],
    variable: "--font-lato",
    display: "swap",
});

export const metadata: Metadata = {
    title: "EveBash | Premium Wedding Photography",
    description: "Capturing life's most beautiful moments.",
};

export default function PublicLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
            <body className={`${playfair.variable} ${lato.variable} antialiased bg-slate-900 text-slate-200 font-sans`}>
                <AuthProvider>
                    <ThemeProvider>
                        {/* No global Navbar here */}
                        <main className="min-h-screen">
                            {children}
                        </main>
                        <Footer />
                    </ThemeProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
