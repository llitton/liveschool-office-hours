import { NextResponse } from 'next/server';

// POST - Disconnect the calendar (clear the session cookie)
export async function POST() {
  const response = NextResponse.json({ success: true });

  // Delete the calendar token cookie
  response.cookies.delete('attendee_ms_calendar');

  return response;
}
