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

export interface EventAccess {
  session: OHAdmin;
  role: 'owner' | 'host' | 'backup';
  canManageSlots: boolean;
  canViewBookings: boolean;
}

/**
 * Check if the current admin has access to a specific event.
 * Returns the session and access details if authorized.
 * Throws if not authorized.
 */
export async function requireEventAccess(eventId: string): Promise<EventAccess> {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }

  const supabase = getServiceSupabase();

  // Check if admin is the event owner
  const { data: event } = await supabase
    .from('oh_events')
    .select('host_id')
    .eq('id', eventId)
    .single();

  if (event?.host_id === session.id) {
    return {
      session,
      role: 'owner',
      canManageSlots: true,
      canViewBookings: true,
    };
  }

  // Check if admin is a co-host
  const { data: hostRecord } = await supabase
    .from('oh_event_hosts')
    .select('role, can_manage_slots, can_view_bookings')
    .eq('event_id', eventId)
    .eq('admin_id', session.id)
    .single();

  if (hostRecord) {
    return {
      session,
      role: hostRecord.role as 'owner' | 'host' | 'backup',
      canManageSlots: hostRecord.can_manage_slots,
      canViewBookings: hostRecord.can_view_bookings,
    };
  }

  // Legacy: If event has no host_id set, allow any admin (backwards compatibility)
  if (!event?.host_id) {
    return {
      session,
      role: 'owner',
      canManageSlots: true,
      canViewBookings: true,
    };
  }

  throw new Error('You do not have access to this event');
}

/**
 * Get the admin record with tokens for a specific host.
 * Used when creating calendar events for a slot assigned to a specific host.
 */
export async function getHostWithTokens(hostId: string): Promise<OHAdmin | null> {
  const supabase = getServiceSupabase();

  const { data: admin, error } = await supabase
    .from('oh_admins')
    .select('*')
    .eq('id', hostId)
    .single();

  if (error || !admin) {
    return null;
  }

  // Refresh token if needed
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
        console.error('Token refresh failed for host:', err);
        return admin;
      }
    }
  }

  return admin;
}
