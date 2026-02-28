"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useParams, useRouter } from "next/navigation";

export default function TenantLogoutPage() {
    const { logout } = useAuth();
    const router = useRouter();
    const params = useParams();

    useEffect(() => {
        // Clear all auth storage manually
        sessionStorage.removeItem("wedding_guest_user");
        localStorage.removeItem("wedding_guest_user");

        // Ensure we hard redirect to the tenant login page
        const slug = params?.slug as string;
        if (slug) {
            router.push(`/tenant/${slug}/login`);
        } else {
            router.push("/login"); // fallback
        }

        logout();
    }, [logout, params, router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7] text-[#800000]">
            <div className="text-xl font-serif animate-pulse">Logging out securely...</div>
        </div>
    );
}
