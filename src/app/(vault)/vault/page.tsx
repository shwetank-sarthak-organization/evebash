import { Suspense } from "react";
import { VaultApp } from "@/components/vault/VaultApp";

export default function VaultPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#0E1318]" />}>
            <VaultApp />
        </Suspense>
    );
}
