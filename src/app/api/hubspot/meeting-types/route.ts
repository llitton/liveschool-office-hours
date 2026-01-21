import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getHubSpotMeetingTypes, isHubSpotConnected } from '@/lib/hubspot';

// GET - Fetch available HubSpot meeting types
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if HubSpot is connected
  const connected = await isHubSpotConnected();
  if (!connected) {
    return NextResponse.json({
      connected: false,
      meetingTypes: [],
      message: 'HubSpot is not connected. Connect HubSpot in Settings > Integrations.',
    });
  }

  try {
    const meetingTypes = await getHubSpotMeetingTypes();

    return NextResponse.json({
      connected: true,
      meetingTypes,
    });
  } catch (error) {
    console.error('Failed to fetch HubSpot meeting types:', error);
    return NextResponse.json({
      connected: true,
      meetingTypes: [],
      error: 'Failed to fetch meeting types from HubSpot',
    });
  }
}
