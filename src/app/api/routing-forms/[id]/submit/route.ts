import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { evaluateRules, encodeResponses } from '@/lib/routing';
import type { OHRoutingRule } from '@/types';

// POST submit routing form and get redirect URL (public endpoint)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { responses }: { responses: Record<string, string> } = body;

  if (!responses || typeof responses !== 'object') {
    return NextResponse.json({ error: 'responses object is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Get the routing form with its default event
  const { data: form, error: formError } = await supabase
    .from('oh_routing_forms')
    .select(`
      id,
      default_event_id,
      submission_count,
      default_event:oh_events!default_event_id(id, slug)
    `)
    .eq('id', id)
    .eq('is_active', true)
    .single();

  if (formError || !form) {
    return NextResponse.json({ error: 'Routing form not found' }, { status: 404 });
  }

  // Get all rules for this form
  const { data: rules, error: rulesError } = await supabase
    .from('oh_routing_rules')
    .select(`
      *,
      target_event:oh_events!target_event_id(id, slug),
      target_host:oh_admins!target_host_id(id, email)
    `)
    .eq('routing_form_id', id)
    .eq('is_active', true)
    .order('priority', { ascending: true });

  if (rulesError) {
    return NextResponse.json({ error: rulesError.message }, { status: 500 });
  }

  // Evaluate rules
  const { eventId, hostId } = evaluateRules(
    (rules || []) as OHRoutingRule[],
    responses,
    form.default_event_id
  );

  if (!eventId) {
    return NextResponse.json(
      { error: 'No matching route found and no default event configured' },
      { status: 400 }
    );
  }

  // Get the target event slug
  let targetEventSlug: string | null = null;

  // First check if it came from a rule
  const matchedRule = rules?.find((r) => r.target_event_id === eventId);
  if (matchedRule?.target_event) {
    const targetEvent = matchedRule.target_event as unknown as { slug: string };
    targetEventSlug = targetEvent.slug;
  }

  // If no match, use default event
  if (!targetEventSlug && form.default_event) {
    const defaultEvent = form.default_event as unknown as { slug: string };
    targetEventSlug = defaultEvent.slug;
  }

  if (!targetEventSlug) {
    // Fetch the event slug directly
    const { data: eventData } = await supabase
      .from('oh_events')
      .select('slug')
      .eq('id', eventId)
      .single();

    targetEventSlug = eventData?.slug;
  }

  if (!targetEventSlug) {
    return NextResponse.json({ error: 'Target event not found' }, { status: 404 });
  }

  // Build redirect URL
  const prefill = encodeResponses(responses);
  let redirectUrl = `/book/${targetEventSlug}?prefill=${prefill}`;

  // Add host parameter if specified
  if (hostId) {
    redirectUrl += `&host=${hostId}`;
  }

  // Increment submission count
  await supabase
    .from('oh_routing_forms')
    .update({
      submission_count: (form.submission_count || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  return NextResponse.json({
    redirectUrl,
    eventId,
    hostId,
    eventSlug: targetEventSlug,
  });
}
