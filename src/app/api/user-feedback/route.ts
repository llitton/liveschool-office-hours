import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { notifyUserFeedback } from '@/lib/slack';

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { category, message, pageUrl } = body;

  // Validate required fields
  if (!category || !['bug', 'suggestion', 'question'].includes(category)) {
    return NextResponse.json({ error: 'Valid category required (bug, suggestion, question)' }, { status: 400 });
  }

  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Get admin info
  const { data: admin } = await supabase
    .from('oh_admins')
    .select('id, name')
    .eq('email', session.email)
    .single();

  // Insert feedback
  const { data: feedback, error } = await supabase
    .from('oh_user_feedback')
    .insert({
      admin_id: admin?.id || null,
      admin_email: session.email,
      admin_name: admin?.name || session.email.split('@')[0],
      category,
      message: message.trim(),
      page_url: pageUrl || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to save feedback:', error);
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
  }

  // Send Slack notification (don't wait for it, don't fail if it errors)
  notifyUserFeedback({
    name: admin?.name || session.email.split('@')[0],
    email: session.email,
    category,
    message: message.trim(),
    pageUrl,
  }).catch((err) => {
    console.error('Failed to send Slack notification:', err);
  });

  return NextResponse.json({ success: true, id: feedback.id });
}
