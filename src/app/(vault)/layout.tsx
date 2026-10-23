import type { Metadata, Viewport } from "next";
import "../globals.css";
import { inter, playfair } from "../fonts";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { MobileAppGate } from "@/components/MobileAppGate";
import { APP_GATE_ENABLED, appGateHeadScript } from "@/lib/appGate";

export const metadata: Metadata = {
    metadataBase: new URL("https://www.evebash.com"),
    title: { default: "EB Vault · EveBash", template: "%s · EB Vault" },
    description: "Your private EveBash storage for documents, photos, videos and other files.",
    robots: { index: false, follow: false },
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
    themeColor: "#0E1318",
};

// EB Vault is its own product area: no event navbar or marketing footer.
export default function VaultLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" suppressHydrationWarning className={`${inter.variable} ${playfair.variable}`}>
            <head>{APP_GATE_ENABLED && <script dangerouslySetInnerHTML={{ __html: appGateHeadScript }} />}</head>
            <body className="antialiased font-sans bg-[#0E1318] text-[var(--site-text)]">
                {APP_GATE_ENABLED && <MobileAppGate />}
                <AuthProvider>
                    <ThemeProvider>{children}</ThemeProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
