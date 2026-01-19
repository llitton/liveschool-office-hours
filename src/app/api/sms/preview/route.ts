import { NextRequest, NextResponse } from 'next/server';
import { processSMSTemplate, calculateSMSSegments } from '@/lib/sms';
import { getServiceSupabase } from '@/lib/supabase';
import { formatInTimeZone } from 'date-fns-tz';
import { addDays } from 'date-fns';

// POST /api/sms/preview - Preview an SMS template with sample data
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { template, eventId } = body;

  if (!template) {
    return NextResponse.json({ error: 'Template is required' }, { status: 400 });
  }

  // Get event details if provided
  let eventName = 'Demo Session';
  let hostName = 'Your Host';
  let timezone = 'America/New_York';

  if (eventId) {
    const supabase = getServiceSupabase();
    const { data: event } = await supabase
      .from('oh_events')
      .select('name, host_name, display_timezone')
      .eq('id', eventId)
      .single();

    if (event) {
      eventName = event.name;
      hostName = event.host_name;
      timezone = event.display_timezone || timezone;
    }
  }

  // Sample data for preview
  const sampleDate = addDays(new Date(), 1); // Tomorrow
  const sampleVariables: Record<string, string> = {
    first_name: 'Sarah',
    last_name: 'Johnson',
    email: 'sarah@example.com',
    event_name: eventName,
    host_name: hostName,
    date: formatInTimeZone(sampleDate, timezone, 'EEEE, MMMM d'),
    time: formatInTimeZone(sampleDate, timezone, 'h:mm a'),
    time_with_timezone: `${formatInTimeZone(sampleDate, timezone, 'h:mm a')} ET`,
    timezone: timezone,
    meet_link: 'https://meet.google.com/abc-defg-hij',
  };

  // Process the template
  const preview = processSMSTemplate(template, sampleVariables);

  // Calculate segments
  const { segments, encoding } = calculateSMSSegments(preview);

  // Generate warnings
  const warnings: string[] = [];

  if (segments > 1) {
    warnings.push(`This message will be sent as ${segments} SMS segments, which may increase costs.`);
  }

  if (encoding === 'unicode') {
    warnings.push('Message contains special characters (Unicode). Character limit per segment is 70 instead of 160.');
  }

  if (preview.length > 160 && segments === 1) {
    // This shouldn't happen but just in case
    warnings.push('Message is close to the segment limit.');
  }

  // Check for unresolved template variables
  const unresolvedVars = preview.match(/\{\{[^}]+\}\}/g);
  if (unresolvedVars) {
    warnings.push(`Some template variables could not be resolved: ${unresolvedVars.join(', ')}`);
  }

  return NextResponse.json({
    preview,
    characterCount: preview.length,
    segmentCount: segments,
    encoding,
    maxCharacters: encoding === 'gsm' ? 160 : 70,
    warnings,
    sampleData: sampleVariables,
  });
}
