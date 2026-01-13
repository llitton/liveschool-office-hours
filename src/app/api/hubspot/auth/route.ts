import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const HUBSPOT_REDIRECT_URI = process.env.NEXT_PUBLIC_BASE_URL
  ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/hubspot/auth`
  : 'http://localhost:3000/api/hubspot/auth';

const SCOPES = [
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'crm.objects.deals.read',
  'crm.objects.companies.read',
  'sales-email-read',
  'crm.objects.marketing_events.read',
].join(' ');

// GET - Start OAuth flow or handle callback
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');

  // If no code, redirect to HubSpot OAuth
  if (!code) {
    try {
      await requireAuth();
    } catch {
      return NextResponse.redirect(new URL('/admin', request.url));
    }

    if (!HUBSPOT_CLIENT_ID) {
      return NextResponse.json(
        { error: 'HubSpot client ID not configured' },
        { status: 500 }
      );
    }

    const authUrl = new URL('https://app.hubspot.com/oauth/authorize');
    authUrl.searchParams.set('client_id', HUBSPOT_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', HUBSPOT_REDIRECT_URI);
    authUrl.searchParams.set('scope', SCOPES);

    return NextResponse.redirect(authUrl.toString());
  }

  // Handle callback with authorization code
  if (!HUBSPOT_CLIENT_ID || !HUBSPOT_CLIENT_SECRET) {
    return NextResponse.redirect(
      new URL('/admin/integrations?error=config', request.url)
    );
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: HUBSPOT_CLIENT_ID,
        client_secret: HUBSPOT_CLIENT_SECRET,
        redirect_uri: HUBSPOT_REDIRECT_URI,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      console.error('HubSpot token exchange failed:', error);
      return NextResponse.redirect(
        new URL('/admin/integrations?error=token', request.url)
      );
    }

    const tokens = await tokenResponse.json();

    // Get portal info
    const portalResponse = await fetch(
      'https://api.hubapi.com/oauth/v1/access-tokens/' + tokens.access_token
    );
    const portalInfo = await portalResponse.json();

    const supabase = getServiceSupabase();

    // Deactivate any existing HubSpot config
    await supabase
      .from('oh_hubspot_config')
      .update({ is_active: false })
      .eq('is_active', true);

    // Save new config
    const { error: insertError } = await supabase
      .from('oh_hubspot_config')
      .insert({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        portal_id: portalInfo.hub_id?.toString() || '',
        is_active: true,
      });

    if (insertError) {
      console.error('Failed to save HubSpot config:', insertError);
      return NextResponse.redirect(
        new URL('/admin/integrations?error=save', request.url)
      );
    }

    return NextResponse.redirect(
      new URL('/admin/integrations?success=hubspot', request.url)
    );
  } catch (error) {
    console.error('HubSpot OAuth error:', error);
    return NextResponse.redirect(
      new URL('/admin/integrations?error=unknown', request.url)
    );
  }
}

// DELETE - Disconnect HubSpot
export async function DELETE() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  const { error } = await supabase
    .from('oh_hubspot_config')
    .update({ is_active: false })
    .eq('is_active', true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// POST - Get connection status
export async function POST() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from('oh_hubspot_config')
    .select('portal_id, created_at')
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    portalId: data.portal_id,
    connectedAt: data.created_at,
  });
}

// PUT - Save Private App access token
export async function PUT(request: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { access_token } = body;

  if (!access_token) {
    return NextResponse.json({ error: 'Access token is required' }, { status: 400 });
  }

  // Verify the token works by making a test API call
  try {
    const testResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!testResponse.ok) {
      return NextResponse.json({ error: 'Invalid access token. Please check your token and try again.' }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: 'Failed to verify token with HubSpot' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Deactivate any existing HubSpot config
  await supabase
    .from('oh_hubspot_config')
    .update({ is_active: false })
    .eq('is_active', true);

  // Save new config (Private App tokens don't have refresh tokens)
  const { error: insertError } = await supabase
    .from('oh_hubspot_config')
    .insert({
      access_token,
      refresh_token: null,
      portal_id: null,
      is_active: true,
    });

  if (insertError) {
    console.error('Failed to save HubSpot config:', insertError);
    return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
