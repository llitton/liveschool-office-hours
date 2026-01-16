import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode, getUserInfo } from '@/lib/google';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=${error}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=no_code`
    );
  }

  try {
    // Exchange code for tokens
    const tokens = await getTokensFromCode(code);

    if (!tokens.access_token) {
      throw new Error('No access token received');
    }

    // Get user info
    const userInfo = await getUserInfo(tokens.access_token);

    if (!userInfo.email) {
      throw new Error('No email in user info');
    }

    // Check if user is an authorized admin
    const supabase = getServiceSupabase();
    const { data: admin, error: adminError } = await supabase
      .from('oh_admins')
      .select('*')
      .eq('email', userInfo.email)
      .single();

    if (adminError || !admin) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/login?error=unauthorized`
      );
    }

    // Update admin with new tokens
    const tokenExpiry = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : null;

    await supabase
      .from('oh_admins')
      .update({
        google_access_token: tokens.access_token,
        google_refresh_token: tokens.refresh_token || admin.google_refresh_token,
        token_expires_at: tokenExpiry,
        name: userInfo.name || admin.name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', admin.id);

    // Set session cookie on the redirect response
    const response = NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/admin`);
    response.cookies.set('admin_session', admin.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err) {
    console.error('Auth callback error:', err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=auth_failed`
    );
  }
}
