import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

// GET current admin's profile
export async function GET() {
  try {
    const session = await requireAuth();

    return NextResponse.json({
      id: session.id,
      name: session.name,
      email: session.email,
      profile_image: session.profile_image,
    });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
