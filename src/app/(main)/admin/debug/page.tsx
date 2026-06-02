"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function DebugPage() {
    const [envVars, setEnvVars] = useState<any>({});
    const [dbStatus, setDbStatus] = useState("Checking...");

    useEffect(() => {
        setEnvVars({
            supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
            supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            mediaDomain: process.env.MEDIA_DOMAIN,
            b2Endpoint: process.env.B2_ENDPOINT,
        });

        if (supabase) {
            setDbStatus("✅ Supabase Client Initialized");
        } else {
            setDbStatus("❌ Supabase Client is NULL");
        }
    }, []);

    return (
        <div className="p-10 font-mono text-sm space-y-4">
            <h1 className="text-xl font-bold">Environment Debugger (Supabase Mode)</h1>

            <div className="border p-4 rounded bg-gray-100">
                <h2 className="font-bold mb-2">Supabase Config</h2>
                <ul>
                    {Object.entries(envVars).map(([key, value]) => (
                        <li key={key}>
                            <strong>{key}:</strong> {value ? `✅ Loaded (${(value as string).slice(0, 5)}...)` : "❌ MISSING"}
                        </li>
                    ))}
                </ul>
            </div>

            <div className="border p-4 rounded bg-gray-100">
                <h2 className="font-bold mb-2">Internal Status</h2>
                <p>{dbStatus}</p>
            </div>
        </div>
    );
}
