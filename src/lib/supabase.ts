import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_FETCH_TIMEOUT_MS = 8000;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("[Supabase] Credentials missing. Please check your .env.local file.");
}

const getFetchErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
        return error.name === "AbortError"
            ? "Supabase request timed out"
            : error.message || "Network request failed";
    }
    return "Network request failed";
};

const supabaseFetch: typeof fetch = async (input, init) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SUPABASE_FETCH_TIMEOUT_MS);
    const callerSignal = init?.signal;

    const abortFromCaller = () => controller.abort();
    if (callerSignal) {
        if (callerSignal.aborted) {
            controller.abort();
        } else {
            callerSignal.addEventListener("abort", abortFromCaller, { once: true });
        }
    }

    try {
        return await fetch(input, {
            ...init,
            signal: controller.signal,
        });
    } catch (error: unknown) {
        const message = getFetchErrorMessage(error);

        console.warn("[Supabase] Network request failed:", message);

        return new Response(
            JSON.stringify({
                code: "network_request_failed",
                msg: message,
            }),
            {
                status: 503,
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );
    } finally {
        clearTimeout(timeout);
        callerSignal?.removeEventListener("abort", abortFromCaller);
    }
};

export const supabase = createClient(
    supabaseUrl || "https://placeholder.supabase.co",
    supabaseAnonKey || "placeholder-key",
    {
        global: {
            fetch: supabaseFetch,
        },
    }
);
