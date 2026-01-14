import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getRoundRobinStats } from '@/lib/round-robin';

// GET round-robin stats for an event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: eventId } = await params;

  try {
    const stats = await getRoundRobinStats(eventId);
    return NextResponse.json(stats);
  } catch (err) {
    console.error('Failed to get round-robin stats:', err);
    return NextResponse.json(
      { error: 'Failed to get round-robin stats' },
      { status: 500 }
    );
  }
}
