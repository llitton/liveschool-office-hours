import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { sendEmail } from '@/lib/google';

// POST - Resend invitation email to a team member
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let inviter;
  try {
    inviter = await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Admin ID is required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Get the admin to resend invitation to
  const { data: admin, error: adminError } = await supabase
    .from('oh_admins')
    .select('id, email, name, google_access_token')
    .eq('id', id)
    .single();

  if (adminError || !admin) {
    return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
  }

  // Check if user has already connected Google (already active)
  if (admin.google_access_token) {
    return NextResponse.json(
      { error: 'This team member has already activated their account' },
      { status: 400 }
    );
  }

  // Check if inviter has Google connected (required to send email)
  if (!inviter.google_access_token || !inviter.google_refresh_token) {
    return NextResponse.json(
      { error: 'You need to connect your Google account to send invitations' },
      { status: 400 }
    );
  }

  // Send the invitation email
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const inviterName = inviter.name || inviter.email;
    const inviteeName = admin.name || admin.email.split('@')[0];

    const profileImageHtml = inviter.profile_image
      ? `<img src="${inviter.profile_image}" alt="${inviterName}" style="width: 40px; height: 40px; border-radius: 50%; margin-right: 12px; vertical-align: middle;" />`
      : '';

    await sendEmail(
      inviter.google_access_token,
      inviter.google_refresh_token,
      {
        to: admin.email,
        subject: `Reminder: ${inviterName} invited you to Connect with LiveSchool`,
        htmlBody: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a; margin-bottom: 20px;">Reminder: You've been invited to Connect with LiveSchool!</h2>

            <p style="color: #444; font-size: 16px; line-height: 1.6;">
              Hi ${inviteeName},
            </p>

            <p style="color: #444; font-size: 16px; line-height: 1.6;">
              This is a reminder that ${inviterName} has invited you to join <strong>Connect with LiveSchool</strong> — our internal scheduling tool for demos, support calls, onboardings, and office hours.
            </p>

            <div style="margin: 30px 0; text-align: center;">
              <a href="${appUrl}/admin"
                 style="display: inline-block; background-color: #6F71EE; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; width: 100%; max-width: 280px; box-sizing: border-box; text-align: center;">
                Get Started &rarr;
              </a>
              <p style="color: #888; font-size: 13px; margin-top: 10px;">Takes less than 60 seconds</p>
            </div>

            <p style="color: #444; font-size: 16px; line-height: 1.6;">
              Once you sign in with your Google account, you'll be able to:
            </p>

            <ul style="color: #444; font-size: 16px; line-height: 2; list-style: none; padding-left: 0;">
              <li>&#128197; <strong>Set</strong> your availability for calls</li>
              <li>&#128101; <strong>Get assigned</strong> to round-robin demo requests</li>
              <li>&#128203; <strong>Manage</strong> your bookings and calendar</li>
              <li>&#127909; <strong>Connect</strong> with customers via Google Meet</li>
            </ul>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <div style="display: flex; align-items: center;">
                ${profileImageHtml}
                <span style="color: #666; font-size: 14px;">— ${inviterName}</span>
              </div>
            </div>
          </div>
        `,
        replyTo: inviter.email,
      }
    );

    // Update the invitation_last_sent_at timestamp
    const now = new Date().toISOString();
    await supabase
      .from('oh_admins')
      .update({
        invitation_last_sent_at: now,
        // Set invitation_sent_at if this is the first successful send
        ...(admin.google_access_token === null ? {} : {}),
      })
      .eq('id', admin.id);

    // Also update invitation_sent_at if it was never set
    const { data: updatedAdmin } = await supabase
      .from('oh_admins')
      .select('invitation_sent_at')
      .eq('id', admin.id)
      .single();

    if (!updatedAdmin?.invitation_sent_at) {
      await supabase
        .from('oh_admins')
        .update({ invitation_sent_at: now })
        .eq('id', admin.id);
    }

    return NextResponse.json({ success: true, sent_at: now });
  } catch (emailError) {
    console.error('Failed to resend invite email:', emailError);
    return NextResponse.json(
      { error: 'Failed to send invitation email' },
      { status: 500 }
    );
  }
}
