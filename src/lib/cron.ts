import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Verify the cron secret from the Authorization header.
 * Returns a 401 response if unauthorized, or null if authorized.
 */
export function verifyCronSecret(request?: Request | { headers: { get(name: string): string | null } }): NextResponse | null {
  const authHeader = request?.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

type AdminTokens = { google_access_token: string; google_refresh_token: string };

/**
 * Creates a cached admin token lookup function.
 * Queries each unique host email only once, caching the result.
 */
export function createAdminTokenCache(supabase: SupabaseClient) {
  const cache = new Map<string, AdminTokens | null>();

  return async function getAdminTokens(hostEmail: string): Promise<AdminTokens | null> {
    if (cache.has(hostEmail)) return cache.get(hostEmail)!;
    const { data: admin } = await supabase
      .from('oh_admins')
      .select('email, google_access_token, google_refresh_token')
      .eq('email', hostEmail)
      .single();
    const result = (admin?.google_access_token && admin?.google_refresh_token) ? admin : null;
    cache.set(hostEmail, result);
    return result;
  };
}
