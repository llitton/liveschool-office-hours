import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

// GET check if slug is available
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const slug = request.nextUrl.searchParams.get('slug');

  if (!slug) {
    return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
  }

  // Normalize the slug the same way the create endpoint does
  const normalizedSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  const supabase = getServiceSupabase();

  const { data: existingEvent, error } = await supabase
    .from('oh_events')
    .select('id, name')
    .eq('slug', normalizedSlug)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (existingEvent) {
    // Slug is taken - suggest alternatives
    const suggestions = await generateSlugSuggestions(supabase, normalizedSlug);

    return NextResponse.json({
      available: false,
      existingEventName: existingEvent.name,
      suggestions,
    });
  }

  return NextResponse.json({ available: true });
}

async function generateSlugSuggestions(supabase: ReturnType<typeof getServiceSupabase>, baseSlug: string): Promise<string[]> {
  const suggestions: string[] = [];
  const suffixes = ['-team', '-2', '-new', '-v2'];

  for (const suffix of suffixes) {
    const candidateSlug = baseSlug + suffix;
    const { data } = await supabase
      .from('oh_events')
      .select('id')
      .eq('slug', candidateSlug)
      .maybeSingle();

    if (!data) {
      suggestions.push(candidateSlug);
      if (suggestions.length >= 3) break;
    }
  }

  // If standard suffixes are taken, try numbered suffixes
  if (suggestions.length < 3) {
    for (let i = 3; i <= 10 && suggestions.length < 3; i++) {
      const candidateSlug = `${baseSlug}-${i}`;
      const { data } = await supabase
        .from('oh_events')
        .select('id')
        .eq('slug', candidateSlug)
        .maybeSingle();

      if (!data) {
        suggestions.push(candidateSlug);
      }
    }
  }

  return suggestions;
}
