import { cookies } from 'next/headers';
import { getServiceSupabase } from './supabase';
import { refreshAccessToken } from './google';
import type { OHAdmin } from '@/types';

export async function getSession(): Promise<OHAdmin | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('admin_session')?.value;

  if (!sessionId) {
    return null;
  }

  const supabase = getServiceSupabase();
  const { data: admin, error } = await supabase
    .from('oh_admins')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error || !admin) {
    return null;
  }

  // Check if token needs refresh
  if (admin.token_expires_at && admin.google_refresh_token) {
    const expiresAt = new Date(admin.token_expires_at);
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (expiresAt < fiveMinutesFromNow) {
      try {
        const newTokens = await refreshAccessToken(admin.google_refresh_token);

        const tokenExpiry = newTokens.expiry_date
          ? new Date(newTokens.expiry_date).toISOString()
          : null;

        await supabase
          .from('oh_admins')
          .update({
            google_access_token: newTokens.access_token,
            google_refresh_token: newTokens.refresh_token || admin.google_refresh_token,
            token_expires_at: tokenExpiry,
            updated_at: new Date().toISOString(),
          })
          .eq('id', admin.id);

        return {
          ...admin,
          google_access_token: newTokens.access_token as string,
          google_refresh_token: newTokens.refresh_token || admin.google_refresh_token,
          token_expires_at: tokenExpiry,
        };
      } catch (err) {
        console.error('Token refresh failed:', err);
        return null;
      }
    }
  }

  return admin;
}

export async function requireAuth(): Promise<OHAdmin> {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}
