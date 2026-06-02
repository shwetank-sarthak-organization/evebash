"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function DebugDB() {
    const [logs, setLogs] = useState<string[]>([]);

    const log = (msg: string) => setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);

    const checkDB = async () => {
        setLogs([]);
        log("Starting Supabase DB Check...");

        if (!supabase) {
            log("❌ Supabase Client is NULL!");
            return;
        }

        try {
            // 1. Simple Count Check
            const { count, error: countError } = await supabase
                .from('photos')
                .select('*', { count: 'exact', head: true });

            if (countError) throw countError;
            log(`count(): Found ${count} total photos in 'photos' table.`);

            // 2. Fetch limit raw
            const { data: rawData, error: rawError } = await supabase
                .from('photos')
                .select('*')
                .limit(5);

            if (rawError) throw rawError;
            log(`select(*): Fetched ${rawData?.length || 0} records raw.`);
            if (rawData && rawData.length > 0) {
                const first = rawData[0];
                log(`Sample Record [0]: ID=${first.id}, event_id=${first.event_id}`);
            }

            // 3. Test App Query
            log("Testing App Query: select(*) + eq(event_id, 'haldi') + order(uploaded_at, desc)...");
            const { data: qData, error: qError } = await supabase
                .from('photos')
                .select('*')
                .eq('event_id', 'haldi')
                .order('uploaded_at', { ascending: false });

            if (qError) throw qError;
            log(`✅ Query Success: Found ${qData?.length || 0} photos for 'haldi'.`);

        } catch (err: any) {
            log(`❌ Major Error: ${err.message}`);
        }
    };

    return (
        <div className="p-10 font-mono text-sm">
            <h1 className="text-xl font-bold mb-4">Database Debugger (Supabase Mode)</h1>
            <button onClick={checkDB} className="bg-blue-600 text-white px-4 py-2 rounded mb-4">Run Check</button>
            <div className="bg-gray-100 p-4 rounded border h-96 overflow-auto whitespace-pre-wrap">
                {logs.join("\n")}
            </div>
        </div>
    );
}
