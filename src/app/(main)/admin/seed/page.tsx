"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import { seedDatabase } from "@/lib/seed";

export default function AdminPage() {
    const [seedStatus, setSeedStatus] = useState("");
    const [seeding, setSeeding] = useState(false);

    const handleSeedMetadata = async () => {
        setSeeding(true);
        setSeedStatus("Seeding metadata...");
        try {
            await seedDatabase();
            setSeedStatus("✅ Metadata seeded successfully!");
        } catch (error: any) {
            setSeedStatus("❌ Seeding failed: " + error.message);
        } finally {
            setSeeding(false);
        }
    };

    return (
        <div className="min-h-screen bg-royal-cream">
            <Navbar />
            <div className="pt-32 pb-20 max-w-4xl mx-auto p-4">
                <h1 className="text-3xl font-serif text-royal-maroon mb-8 text-center">
                    Admin Dashboard
                </h1>

                <div className="bg-white p-6 rounded-lg shadow-md mb-8 border border-royal-gold">
                    <h2 className="text-xl font-bold text-royal-maroon mb-4">1. Initialize Event Data</h2>
                    <p className="text-sm text-gray-700 mb-4">
                        Click this first to create the Event pages (Haldi, Mehendi, etc.) in the database.
                        This does <strong>not</strong> touch the photos.
                    </p>
                    <button
                        onClick={handleSeedMetadata}
                        disabled={seeding}
                        className={`w-full py-3 rounded font-bold text-lg transition ${seeding
                            ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                            : "bg-royal-maroon text-white hover:bg-rose-900"
                            }`}
                    >
                        {seeding ? "Seeding..." : "Seed All Event Metadata"}
                    </button>
                    {seedStatus && (
                        <div className={`mt-3 p-2 rounded text-center font-mono border ${seedStatus.includes("failed")
                            ? "bg-red-50 border-red-200 text-red-700"
                            : "bg-green-50 border-green-200 text-green-700"
                            }`}>
                            {seedStatus}
                        </div>
                    )}
                </div>

                <div className="bg-white p-6 rounded-lg shadow-md mb-8 border border-royal-gold">
                    <h2 className="text-xl font-bold text-royal-maroon mb-4">2. Media Uploads</h2>
                    <p className="text-sm text-gray-700 mb-4">
                        Media is now uploaded directly to Backblaze B2 and served through the Cloudflare media domain.
                        Use the event dashboard upload controls to add photos and videos.
                    </p>
                </div>
            </div>
        </div>
    );
}

