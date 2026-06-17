import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client. Bypasses RLS, so it MUST only be used in
 * trusted server contexts (e.g. the scheduled Plaid sync cron). Never import
 * this into client components.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for admin client'
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
