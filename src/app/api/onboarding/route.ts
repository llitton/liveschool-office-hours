import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import type { OnboardingState } from '@/types';

// POST - Save onboarding state for an admin
export async function POST(request: NextRequest) {
  const supabase = getServiceSupabase();
  const body = await request.json();

  const { adminId, state } = body as { adminId: string; state: OnboardingState };

  if (!adminId) {
    return NextResponse.json({ error: 'Admin ID is required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('oh_admins')
    .update({ onboarding_progress: state })
    .eq('id', adminId);

  if (error) {
    console.error('Failed to save onboarding state:', error);
    return NextResponse.json({ error: 'Failed to save onboarding state' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// GET - Fetch onboarding state for an admin
export async function GET(request: NextRequest) {
  const supabase = getServiceSupabase();
  const { searchParams } = new URL(request.url);
  const adminId = searchParams.get('adminId');

  if (!adminId) {
    return NextResponse.json({ error: 'Admin ID is required' }, { status: 400 });
  }

  const { data: admin, error } = await supabase
    .from('oh_admins')
    .select('onboarding_progress')
    .eq('id', adminId)
    .single();

  if (error) {
    console.error('Failed to fetch onboarding state:', error);
    return NextResponse.json({ error: 'Failed to fetch onboarding state' }, { status: 500 });
  }

  return NextResponse.json(admin?.onboarding_progress || null);
}
