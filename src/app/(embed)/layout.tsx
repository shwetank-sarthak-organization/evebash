import type { Metadata, Viewport } from "next";
import "../globals.css";
import { inter } from "../fonts";

export const metadata: Metadata = {
    title: "EB Vault viewer",
    robots: { index: false, follow: false },
};

export const viewport: Viewport = {
    themeColor: "#0E1318",
    width: "device-width",
    initialScale: 1,
};

// Bare pages shown inside the mobile app's in-app viewer: no navigation, sign-in or footer.
export default function EmbedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" className={inter.variable}>
            <body className="antialiased font-sans bg-[#0E1318] text-white">{children}</body>
        </html>
    );
}
