"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname, useParams } from "next/navigation";
import { useEffect } from "react";

interface TenantGuardProps {
    children: React.ReactNode;
    slug?: string; // Optional now
}

export default function TenantGuard({ children, slug: propSlug }: TenantGuardProps) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const params = useParams();

    // Prefer prop, fallback to param
    const slug = propSlug || (params?.slug as string);

    useEffect(() => {
        if (!loading) {
            const isLoginPage = pathname?.endsWith("/login");

            // Allow access to login without user
            if (!user && !isLoginPage) {
                router.push(`/tenant/${slug}/login`);
            } else if (user && isLoginPage) {
                router.push(`/tenant/${slug}`);
            }
        }
    }, [user, loading, pathname, router, slug]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-800">
                <div className="text-xl font-serif animate-pulse">Checking Access...</div>
            </div>
        );
    }

    // Optional: Hide Navbar on login page if we want? 
    // For now we just return children as is. 
    // Note: If we are on /login and have a navbar around us in layout, it will show.

    return <>{children}</>;
}
