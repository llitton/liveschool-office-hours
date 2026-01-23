import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

interface ReorderItem {
  id: string;
  display_order: number;
}

// PATCH /api/events/reorder
// Updates display_order for multiple events at once
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { items } = body as { items: ReorderItem[] };

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: items array is required' },
        { status: 400 }
      );
    }

    // Validate items
    for (const item of items) {
      if (!item.id || typeof item.display_order !== 'number') {
        return NextResponse.json(
          { error: 'Invalid item: each item must have id and display_order' },
          { status: 400 }
        );
      }
    }

    const supabase = getServiceSupabase();

    // Update each event's display_order
    // Using Promise.all for concurrent updates
    const updates = items.map((item) =>
      supabase
        .from('oh_events')
        .update({
          display_order: item.display_order,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id)
    );

    const results = await Promise.all(updates);

    // Check for errors
    const errors = results.filter((r) => r.error);
    if (errors.length > 0) {
      console.error('Reorder errors:', errors.map((e) => e.error));
      return NextResponse.json(
        { error: 'Failed to update some events' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, updated: items.length });
  } catch (error) {
    console.error('Reorder error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
