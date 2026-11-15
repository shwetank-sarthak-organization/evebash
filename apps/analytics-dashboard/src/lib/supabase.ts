import { createClient } from '@supabase/supabase-js';
import { currentConfig, currentEnvironment } from './environment';

if (!currentConfig.supabaseUrl || !currentConfig.supabaseAnonKey) {
  console.error(`Missing Supabase settings for ${currentEnvironment} in apps/analytics-dashboard/.env`);
}

// Supabase stores the login under a key that includes the project's ref, so the Staging and Live logins stay apart
export const supabase = createClient(currentConfig.supabaseUrl, currentConfig.supabaseAnonKey);
