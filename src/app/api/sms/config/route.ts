import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSMSConfig, saveSMSConfig, deactivateSMSConfig, testSMSConnection } from '@/lib/sms';
import { createSMSProvider } from '@/lib/sms-providers';
import type { SMSProvider, OHSMSConfig } from '@/types';

// GET - Get current SMS config (masked)
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = await getSMSConfig();

  if (!config) {
    return NextResponse.json({
      connected: false,
      provider: null,
      sender_phone: null,
    });
  }

  return NextResponse.json({
    connected: config.is_active,
    provider: config.provider,
    sender_phone: config.sender_phone,
    // Don't expose API key or secret
  });
}

// POST - Save new SMS config
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { provider, api_key, api_secret, sender_phone } = body as {
    provider: SMSProvider;
    api_key: string;
    api_secret?: string;
    sender_phone?: string;
  };

  if (!provider || !api_key) {
    return NextResponse.json(
      { error: 'Provider and API key are required' },
      { status: 400 }
    );
  }

  // Validate provider
  if (!['aircall', 'twilio', 'messagebird'].includes(provider)) {
    return NextResponse.json(
      { error: 'Invalid provider' },
      { status: 400 }
    );
  }

  // Test connection before saving
  try {
    const testConfig: OHSMSConfig = {
      id: '',
      provider,
      api_key,
      api_secret: api_secret || null,
      sender_phone: sender_phone || null,
      is_active: true,
      created_at: '',
      updated_at: '',
    };

    const providerInstance = createSMSProvider(testConfig);
    const connectionOk = await providerInstance.testConnection();

    if (!connectionOk) {
      return NextResponse.json(
        { error: 'Failed to connect to SMS provider. Please check your credentials.' },
        { status: 400 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 400 }
    );
  }

  // Save the configuration
  const saved = await saveSMSConfig({
    provider,
    api_key,
    api_secret,
    sender_phone,
  });

  if (!saved) {
    return NextResponse.json(
      { error: 'Failed to save SMS configuration' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

// DELETE - Disconnect SMS provider
export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const deactivated = await deactivateSMSConfig();

  if (!deactivated) {
    return NextResponse.json(
      { error: 'Failed to disconnect SMS provider' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
