import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  getPrepResources,
  createPrepResource,
  updatePrepResource,
  deletePrepResource,
} from '@/lib/prep-matcher';

// GET prep resources for an event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: eventId } = await params;
  const resources = await getPrepResources(eventId);

  return NextResponse.json(resources);
}

// POST create a new prep resource
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: eventId } = await params;
  const body = await request.json();
  const { title, content, link, keywords } = body;

  if (!title || !content) {
    return NextResponse.json(
      { error: 'title and content are required' },
      { status: 400 }
    );
  }

  const resource = await createPrepResource(eventId, {
    title,
    content,
    link,
    keywords: keywords || [],
  });

  if (!resource) {
    return NextResponse.json(
      { error: 'Failed to create resource' },
      { status: 500 }
    );
  }

  return NextResponse.json(resource);
}

// PATCH update a prep resource
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { resourceId, title, content, link, keywords } = body;

  if (!resourceId) {
    return NextResponse.json({ error: 'resourceId is required' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if (link !== undefined) updates.link = link;
  if (keywords !== undefined) updates.keywords = keywords;

  const resource = await updatePrepResource(resourceId, updates);

  if (!resource) {
    return NextResponse.json(
      { error: 'Failed to update resource' },
      { status: 500 }
    );
  }

  return NextResponse.json(resource);
}

// DELETE a prep resource
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const resourceId = searchParams.get('resourceId');

  if (!resourceId) {
    return NextResponse.json({ error: 'resourceId is required' }, { status: 400 });
  }

  const success = await deletePrepResource(resourceId);

  if (!success) {
    return NextResponse.json(
      { error: 'Failed to delete resource' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
