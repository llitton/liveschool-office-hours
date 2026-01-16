import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSMSConfig } from '@/lib/sms';

// GET - Check SMS integration status
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = await getSMSConfig();

  return NextResponse.json({
    connected: config !== null && config.is_active,
    provider: config?.provider || null,
  });
}
