import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sendSMS, formatPhoneE164, getSMSConfig } from '@/lib/sms';

// POST - Send test SMS
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { phone } = body as { phone: string };

  if (!phone) {
    return NextResponse.json(
      { error: 'Phone number is required' },
      { status: 400 }
    );
  }

  // Validate and format phone number
  const formattedPhone = formatPhoneE164(phone);
  if (!formattedPhone) {
    return NextResponse.json(
      { error: 'Invalid phone number format' },
      { status: 400 }
    );
  }

  // Check if SMS is configured
  const config = await getSMSConfig();
  if (!config) {
    return NextResponse.json(
      { error: 'SMS is not configured' },
      { status: 400 }
    );
  }

  // Send test message
  const testMessage = 'Test message from LiveSchool Connect - SMS is working!';
  const sent = await sendSMS(formattedPhone, testMessage);

  if (!sent) {
    return NextResponse.json(
      { error: 'Failed to send test SMS. Please check your configuration.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: `Test SMS sent to ${formattedPhone}`,
  });
}
