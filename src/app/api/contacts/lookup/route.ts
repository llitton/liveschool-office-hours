import { NextRequest, NextResponse } from 'next/server';
import { findContactByEmail, isHubSpotConnected } from '@/lib/hubspot';

/**
 * POST /api/contacts/lookup
 * Look up a contact by email and return phone if available
 * Used for pre-filling phone on booking form
 *
 * Body: { email: string }
 * Returns: { found: boolean, firstName?: string, lastName?: string, phone?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if HubSpot is connected
    const connected = await isHubSpotConnected();
    if (!connected) {
      return NextResponse.json({ found: false });
    }

    // Look up contact
    const contact = await findContactByEmail(email.trim().toLowerCase());

    if (!contact) {
      return NextResponse.json({ found: false });
    }

    // Extract phone - prefer phone over mobilephone
    const phone = contact.properties.phone || contact.properties.mobilephone || null;

    return NextResponse.json({
      found: true,
      firstName: contact.properties.firstname || null,
      lastName: contact.properties.lastname || null,
      phone: phone,
    });
  } catch (error) {
    console.error('Contact lookup error:', error);
    return NextResponse.json({ found: false });
  }
}
