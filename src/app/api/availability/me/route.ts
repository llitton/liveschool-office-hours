import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import { getFreeBusy } from '@/lib/google';
import { addDays } from 'date-fns';

// GET current user's busy times (for mutual availability on booking pages)
export async function GET(request: NextRequest) {
  const session = await getSession();

  // If not logged in, return empty response (not an error)
  if (!session) {
    return NextResponse.json({
      logged_in: false,
      busy_times: [],
    });
  }

  const searchParams = request.nextUrl.searchParams;
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');

  // Default to 2 weeks if no dates provided
  const start = startDate ? new Date(startDate) : new Date();
  const end = endDate ? new Date(endDate) : addDays(start, 14);

  const supabase = getServiceSupabase();

  // Get admin with tokens
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('id, name, email, profile_image, google_access_token, google_refresh_token')
    .eq('email', session.email)
    .single();

  if (!admin) {
    return NextResponse.json({
      logged_in: false,
      busy_times: [],
    });
  }

  let busyTimes: { start: string; end: string; title?: string }[] = [];

  // Fetch live calendar data if Google is connected
  if (admin.google_access_token && admin.google_refresh_token) {
    try {
      const googleBusy = await getFreeBusy(
        admin.google_access_token,
        admin.google_refresh_token,
        start.toISOString(),
        end.toISOString()
      );
      busyTimes = googleBusy;
    } catch (err) {
      console.error('Failed to fetch Google Calendar for mutual availability:', err);
      // Fall back to cached busy blocks
      const { data: cached } = await supabase
        .from('oh_busy_blocks')
        .select('start_time, end_time')
        .eq('admin_id', admin.id)
        .gte('start_time', start.toISOString())
        .lte('end_time', end.toISOString());

      if (cached) {
        busyTimes = cached.map(b => ({ start: b.start_time, end: b.end_time }));
      }
    }
  }

  // Also get their existing slot bookings (meetings they're hosting)
  const { data: slots } = await supabase
    .from('oh_slots')
    .select(`
      start_time,
      end_time,
      event:oh_events(name)
    `)
    .eq('is_cancelled', false)
    .gte('start_time', start.toISOString())
    .lte('end_time', end.toISOString());

  // Add slots to busy times with event names
  const slotBusy = (slots || [])
    .map(slot => {
      // slot.event is joined data - can be object, array, or null
      let eventName = 'Meeting';
      if (slot.event) {
        // Handle both object and array cases from Supabase
        if (Array.isArray(slot.event) && slot.event.length > 0) {
          eventName = (slot.event[0] as { name?: string })?.name || 'Meeting';
        } else if (typeof slot.event === 'object' && 'name' in slot.event) {
          eventName = (slot.event as { name: string }).name;
        }
      }
      return {
        start: slot.start_time,
        end: slot.end_time,
        title: eventName,
      };
    });

  return NextResponse.json({
    logged_in: true,
    user: {
      name: admin.name,
      email: admin.email,
      profile_image: admin.profile_image,
    },
    google_connected: !!(admin.google_access_token && admin.google_refresh_token),
    busy_times: [...busyTimes, ...slotBusy],
  });
}
