import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireEventAccess } from '@/lib/auth';
import type { OHEventHost } from '@/types';

// GET hosts for an event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;

  try {
    const access = await requireEventAccess(eventId);
    if (!access.canViewBookings) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  // Get event with owner info
  const { data: event } = await supabase
    .from('oh_events')
    .select('host_id, host_name, host_email')
    .eq('id', eventId)
    .single();

  // Get co-hosts with admin details
  const { data: hosts, error } = await supabase
    .from('oh_event_hosts')
    .select(`
      *,
      admin:oh_admins(id, name, email)
    `)
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get owner details if host_id is set
  let owner = null;
  if (event?.host_id) {
    const { data: ownerData } = await supabase
      .from('oh_admins')
      .select('id, name, email')
      .eq('id', event.host_id)
      .single();
    owner = ownerData;
  }

  return NextResponse.json({
    owner,
    hosts: hosts || [],
    legacyHostName: event?.host_name,
    legacyHostEmail: event?.host_email,
  });
}

// POST add a host to an event
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;

  try {
    const access = await requireEventAccess(eventId);
    if (access.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only event owners can add hosts' },
        { status: 403 }
      );
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { admin_id, role = 'host', can_manage_slots = true, can_view_bookings = true } = body;

  if (!admin_id) {
    return NextResponse.json({ error: 'admin_id is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Verify admin exists
  const { data: admin, error: adminError } = await supabase
    .from('oh_admins')
    .select('id, name, email')
    .eq('id', admin_id)
    .single();

  if (adminError || !admin) {
    return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
  }

  // Check if already a host
  const { data: existing } = await supabase
    .from('oh_event_hosts')
    .select('id')
    .eq('event_id', eventId)
    .eq('admin_id', admin_id)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: 'This admin is already a host for this event' },
      { status: 400 }
    );
  }

  // Add host
  const { data: host, error } = await supabase
    .from('oh_event_hosts')
    .insert({
      event_id: eventId,
      admin_id,
      role,
      can_manage_slots,
      can_view_bookings,
    })
    .select(`
      *,
      admin:oh_admins(id, name, email)
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(host);
}

// DELETE remove a host from an event
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;

  try {
    const access = await requireEventAccess(eventId);
    if (access.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only event owners can remove hosts' },
        { status: 403 }
      );
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const hostId = searchParams.get('hostId');

  if (!hostId) {
    return NextResponse.json({ error: 'hostId is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  const { error } = await supabase
    .from('oh_event_hosts')
    .delete()
    .eq('id', hostId)
    .eq('event_id', eventId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// PATCH update host permissions
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;

  try {
    const access = await requireEventAccess(eventId);
    if (access.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only event owners can update host permissions' },
        { status: 403 }
      );
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { hostId, role, can_manage_slots, can_view_bookings } = body;

  if (!hostId) {
    return NextResponse.json({ error: 'hostId is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  const updateData: Partial<OHEventHost> = {};
  if (role !== undefined) updateData.role = role;
  if (can_manage_slots !== undefined) updateData.can_manage_slots = can_manage_slots;
  if (can_view_bookings !== undefined) updateData.can_view_bookings = can_view_bookings;

  const { data: host, error } = await supabase
    .from('oh_event_hosts')
    .update(updateData)
    .eq('id', hostId)
    .eq('event_id', eventId)
    .select(`
      *,
      admin:oh_admins(id, name, email)
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(host);
}
