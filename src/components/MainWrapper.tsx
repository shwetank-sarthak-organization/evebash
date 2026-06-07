"use client";

import { usePathname } from "next/navigation";

export default function MainWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isLogin = pathname === '/login';

    return (
        <main className={isLogin ? "min-h-screen" : "pt-20 min-h-screen"}>
            {children}
        </main>
    );
}
