"use client";

import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import LoadingScreen from "@/components/LoadingScreen";

export default function RouteGuard({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!loading) {
            // Allow access to login without user
            if (!user && pathname !== "/login") {
                router.push("/login");
            } else if (user && pathname === "/login") {
                router.push("/");
            }
        }
    }, [user, loading, pathname, router]);

    if (loading) {
        return <LoadingScreen message="Capturing the moment" />;
    }

    // Optional: Hide Navbar on login page if we want? 
    // For now we just return children as is. 
    // Note: If we are on /login and have a navbar around us in layout, it will show.

    return <>{children}</>;
}
