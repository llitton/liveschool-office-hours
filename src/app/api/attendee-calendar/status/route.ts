import { NextRequest, NextResponse } from 'next/server';
import { decryptTokens } from '@/lib/microsoft';

// GET - Check if calendar is connected and return email
export async function GET(request: NextRequest) {
  const tokenCookie = request.cookies.get('attendee_ms_calendar');

  if (!tokenCookie) {
    return NextResponse.json({ connected: false });
  }

  try {
    const tokens = decryptTokens(tokenCookie.value);

    // Check if token is expired
    if (tokens.expires_at < Date.now()) {
      // Token expired and we can't refresh without a request
      // The busy endpoint will handle refresh
      return NextResponse.json({
        connected: true,
        email: tokens.email,
        needsRefresh: true,
      });
    }

    return NextResponse.json({
      connected: true,
      email: tokens.email,
    });
  } catch (err) {
    console.error('Error decrypting calendar token:', err);
    // Invalid token, clear it
    const response = NextResponse.json({ connected: false });
    response.cookies.delete('attendee_ms_calendar');
    return response;
  }
}
