import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

type BulkAction = 'disable' | 'enable' | 'delete' | 'duplicate';

interface BulkRequest {
  action: BulkAction;
  eventIds: string[];
}

// POST /api/events/bulk
// Perform bulk operations on multiple events
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, eventIds } = body as BulkRequest;

    if (!action || !Array.isArray(eventIds) || eventIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: action and eventIds are required' },
        { status: 400 }
      );
    }

    if (!['disable', 'enable', 'delete', 'duplicate'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Allowed: disable, enable, delete, duplicate' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    switch (action) {
      case 'disable': {
        const { error } = await supabase
          .from('oh_events')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .in('id', eventIds);

        if (error) throw error;
        return NextResponse.json({ success: true, action, count: eventIds.length });
      }

      case 'enable': {
        const { error } = await supabase
          .from('oh_events')
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .in('id', eventIds);

        if (error) throw error;
        return NextResponse.json({ success: true, action, count: eventIds.length });
      }

      case 'delete': {
        // First, check if any events have active bookings
        const { data: bookings } = await supabase
          .from('oh_bookings')
          .select('id, slot:oh_slots!inner(event_id)')
          .in('slot.event_id', eventIds)
          .is('cancelled_at', null);

        if (bookings && bookings.length > 0) {
          return NextResponse.json(
            {
              error: 'Cannot delete events with active bookings',
              details: `${bookings.length} active booking(s) found`,
            },
            { status: 400 }
          );
        }

        // Delete in order: bookings -> slots -> event_hosts -> events
        // Note: With proper cascade constraints this might not be needed,
        // but doing it explicitly is safer

        // Get slot IDs for these events
        const { data: slots } = await supabase
          .from('oh_slots')
          .select('id')
          .in('event_id', eventIds);

        if (slots && slots.length > 0) {
          const slotIds = slots.map((s) => s.id);

          // Delete bookings for these slots
          await supabase.from('oh_bookings').delete().in('slot_id', slotIds);

          // Delete slots
          await supabase.from('oh_slots').delete().in('event_id', eventIds);
        }

        // Delete event hosts
        await supabase.from('oh_event_hosts').delete().in('event_id', eventIds);

        // Delete events
        const { error } = await supabase.from('oh_events').delete().in('id', eventIds);

        if (error) throw error;
        return NextResponse.json({ success: true, action, count: eventIds.length });
      }

      case 'duplicate': {
        // Fetch all events to duplicate
        const { data: events, error: fetchError } = await supabase
          .from('oh_events')
          .select('*')
          .in('id', eventIds);

        if (fetchError) throw fetchError;
        if (!events || events.length === 0) {
          return NextResponse.json({ error: 'No events found' }, { status: 404 });
        }

        const newEvents = [];
        for (const event of events) {
          // Generate unique slug
          const baseSlug = event.slug.replace(/-copy(-\d+)?$/, '');
          let newSlug = `${baseSlug}-copy`;
          let counter = 1;

          // Check if slug exists
          const { data: existing } = await supabase
            .from('oh_events')
            .select('slug')
            .eq('slug', newSlug)
            .maybeSingle();

          if (existing) {
            // Find next available number
            const { data: similar } = await supabase
              .from('oh_events')
              .select('slug')
              .like('slug', `${baseSlug}-copy%`);

            if (similar) {
              const numbers = similar
                .map((e) => {
                  const match = e.slug.match(/-copy-(\d+)$/);
                  return match ? parseInt(match[1], 10) : 1;
                })
                .filter((n) => !isNaN(n));
              counter = Math.max(...numbers, 1) + 1;
            }
            newSlug = `${baseSlug}-copy-${counter}`;
          }

          // Create new event
          const newEvent = {
            ...event,
            id: undefined, // Let DB generate new ID
            slug: newSlug,
            name: `${event.name} (Copy)`,
            created_at: undefined,
            updated_at: undefined,
            display_order: 0, // Put at top
          };

          // Remove undefined fields
          Object.keys(newEvent).forEach((key) => {
            if (newEvent[key as keyof typeof newEvent] === undefined) {
              delete newEvent[key as keyof typeof newEvent];
            }
          });

          const { data: created, error: insertError } = await supabase
            .from('oh_events')
            .insert(newEvent)
            .select()
            .single();

          if (insertError) {
            console.error('Error duplicating event:', insertError);
            continue;
          }

          newEvents.push(created);

          // Copy event hosts
          const { data: hosts } = await supabase
            .from('oh_event_hosts')
            .select('*')
            .eq('event_id', event.id);

          if (hosts && hosts.length > 0) {
            const newHosts = hosts.map((h) => ({
              event_id: created.id,
              admin_id: h.admin_id,
              role: h.role,
              can_manage_slots: h.can_manage_slots,
              can_view_bookings: h.can_view_bookings,
            }));

            await supabase.from('oh_event_hosts').insert(newHosts);
          }
        }

        return NextResponse.json({
          success: true,
          action,
          count: newEvents.length,
          events: newEvents.map((e) => ({ id: e.id, slug: e.slug, name: e.name })),
        });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Bulk operation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
