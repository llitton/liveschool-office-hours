import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// POST upload profile image
export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    // Generate unique filename
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${session.id}-${Date.now()}.${fileExt}`;
    const filePath = `profile-images/${fileName}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('admin-assets')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload image. Please try again.' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('admin-assets')
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;

    // Delete old profile image if exists
    if (session.profile_image) {
      try {
        // Extract path from URL
        const oldPath = session.profile_image.split('/admin-assets/')[1];
        if (oldPath) {
          await supabase.storage.from('admin-assets').remove([oldPath]);
        }
      } catch (err) {
        console.warn('Failed to delete old profile image:', err);
      }
    }

    // Update admin record with new image URL
    const { error: updateError } = await supabase
      .from('oh_admins')
      .update({
        profile_image: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    if (updateError) {
      console.error('Database update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to save image. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: publicUrl });
  } catch (err) {
    console.error('Profile image upload error:', err);
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

// DELETE remove profile image
export async function DELETE() {
  let session;
  try {
    session = await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  // Delete image from storage if exists
  if (session.profile_image) {
    try {
      const path = session.profile_image.split('/admin-assets/')[1];
      if (path) {
        await supabase.storage.from('admin-assets').remove([path]);
      }
    } catch (err) {
      console.warn('Failed to delete profile image from storage:', err);
    }
  }

  // Clear profile_image in database
  const { error } = await supabase
    .from('oh_admins')
    .update({
      profile_image: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', session.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
