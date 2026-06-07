import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("[Supabase] Mobile credentials missing in Expo environment.");
}

const SUPABASE_FETCH_TIMEOUT_MS = 6000;

const supabaseFetch: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUPABASE_FETCH_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: init?.signal || controller.signal,
    });
  } catch (error: any) {
    const message = error?.name === 'AbortError'
      ? 'Supabase request timed out'
      : error?.message || 'Network request failed';
    console.warn('[Supabase] Network request failed:', message);

    return new Response(
      JSON.stringify({
        code: 'network_request_failed',
        msg: message,
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } finally {
    clearTimeout(timeout);
  }
};

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key",
  {
    global: {
      fetch: supabaseFetch,
    },
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
